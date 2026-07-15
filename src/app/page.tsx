"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, firebaseConfigured } from "@/lib/firebase";
import { SessionUser, UserProfile } from "@/lib/types";
import { ensureUserProfile, subscribeUserProfile } from "@/lib/data-service";
import { AuthScreen } from "@/components/AuthScreen";
import { AppShell } from "@/components/AppShell";

export default function Home() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(firebaseConfigured);
  const [accessError, setAccessError] = useState("");

  useEffect(() => {
    if (!firebaseConfigured || !auth) return;
    let stopProfile: (() => void) | undefined;

    const stopAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      stopProfile?.();
      stopProfile = undefined;
      setAccessError("");

      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const initialProfile = await ensureUserProfile(firebaseUser);
        setUser({ ...initialProfile });
        stopProfile = subscribeUserProfile(firebaseUser.uid, (profile: UserProfile | null) => {
          if (profile) setUser({ ...profile });
        });
      } catch (error) {
        setAccessError(error instanceof Error ? error.message : "Unable to open your user profile.");
      } finally {
        setLoading(false);
      }
    });

    return () => {
      stopProfile?.();
      stopAuth();
    };
  }, []);

  async function logoutDisabledAccount() {
    if (auth) await signOut(auth);
  }

  if (loading) return <main className="splash-screen"><div className="splash-logo">RT</div><p>Opening your document log…</p></main>;
  if (accessError) return <main className="blocked-page"><div className="blocked-card"><h1>Unable to open the system</h1><p>{accessError}</p><button className="primary-button" onClick={logoutDisabledAccount}>Return to sign in</button></div></main>;
  if (!user) return <AuthScreen onDemo={setUser} />;
  if (!user.active) return <main className="blocked-page"><div className="blocked-card"><h1>Account disabled</h1><p>An administrator has disabled this account. Contact your system administrator to restore access.</p><button className="primary-button" onClick={logoutDisabledAccount}>Sign out</button></div></main>;
  return <AppShell user={user} onDemoLogout={() => setUser(null)} />;
}
