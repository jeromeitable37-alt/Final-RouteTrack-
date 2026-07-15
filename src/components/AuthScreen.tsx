"use client";

import { FormEvent, useState } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { Eye, EyeOff, FileCheck2, LockKeyhole, ShieldCheck, Smartphone } from "lucide-react";
import { auth, db, firebaseConfigured } from "@/lib/firebase";
import { SessionUser, UserProfile } from "@/lib/types";
import { isBootstrapAdminEmail } from "@/lib/admin-config";

export function AuthScreen({ onDemo }: { onDemo: (user: SessionUser) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [position, setPosition] = useState("Student Assistant");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!auth) return;
    setLoading(true);
    setError("");
    try {
      if (mode === "register") {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name.trim()) await updateProfile(credential.user, { displayName: name.trim() });
        if (db) {
          const now = new Date().toISOString();
          const profile: UserProfile = {
            uid: credential.user.uid,
            email: email.trim().toLowerCase(),
            displayName: name.trim(),
            department: department.trim(),
            position: position.trim(),
            phone: "",
            photoDataUrl: "",
            role: isBootstrapAdminEmail(email) ? "admin" : "staff",
            active: true,
            createdAt: now,
            updatedAt: now,
          };
          await setDoc(doc(db, "users", credential.user.uid), profile, { merge: true });
        }
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to continue.";
      setError(message.replace("Firebase: ", "").replace(/\(auth\/.+\)\.?/, ""));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-brand-panel">
        <div className="auth-logo"><FileCheck2 size={30} /></div>
        <p className="eyebrow">DOCUMENT ROUTING MONITOR</p>
        <h1>Record a route in seconds and trace the last person who received it.</h1>
        <p className="auth-lead">Built for quick PRF, SRF, CRF, and PO monitoring with exact dates, times, people, departments, and a complete chain of custody.</p>
        <div className="auth-benefits">
          <div><LockKeyhole size={20} /><span>Firebase-secured passwords and user accounts</span></div>
          <div><ShieldCheck size={20} /><span>Administrator and staff access</span></div>
          <div><Smartphone size={20} /><span>Optimized for phone and desktop use</span></div>
        </div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-card">
          <p className="eyebrow">ROUTETRACK</p>
          <h2>{firebaseConfigured ? (mode === "login" ? "Sign in" : "Create your account") : "Try the system"}</h2>
          <p className="muted">{firebaseConfigured ? "Use your account to access your routing records." : "Firebase is not configured. Demo data stays in this browser only."}</p>

          {firebaseConfigured ? <form onSubmit={submit} className="stack-form">
            {mode === "register" && <>
              <label>Full name<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
              <label>Department / office<input value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="Example: Student Assistant / Records" /></label>
              <label>Position<input value={position} onChange={(event) => setPosition(event.target.value)} /></label>
            </>}
            <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <label>Password<div className="password-field"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
            {error && <p className="form-error">{error}</p>}
            <button className="primary-button full-button" disabled={loading}>{loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
            <button type="button" className="text-button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "No account yet? Create one" : "Already registered? Sign in"}</button>
          </form> : <button className="primary-button full-button" onClick={() => onDemo({
            uid: "demo-admin",
            email: "admin@demo.local",
            displayName: "Demo Administrator",
            department: "Student Assistant / Records",
            position: "Administrator",
            phone: "",
            photoDataUrl: "",
            role: "admin",
            active: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isDemo: true,
          })}>Open admin demo dashboard</button>}

          <p className="auth-note">Passwords are handled by Firebase Authentication. The system does not save readable passwords in Firestore.</p>
        </div>
      </section>
    </main>
  );
}
