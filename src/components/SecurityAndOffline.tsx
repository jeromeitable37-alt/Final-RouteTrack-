"use client";

import { useEffect, useRef, useState } from "react";
import { CloudOff, Cloud, LogOut, ShieldCheck, Wifi, WifiOff } from "lucide-react";
import { LoginActivityRecord, SessionUser } from "@/lib/types";
import { recordLoginActivity, subscribeLoginActivity } from "@/lib/operations-service";
import { formatDateTime } from "@/lib/utils";

export function OnlineStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return <div className={`online-status ${online ? "online" : "offline"}`}>{online ? <><Wifi size={15} /> Online</> : <><WifiOff size={15} /> Offline — changes will sync later</>}</div>;
}

export function IdleSessionGuard({ onTimeout, onWarning }: { onTimeout: () => void; onWarning: (message: string) => void }) {
  const lastActivity = useRef(Date.now());
  const warned = useRef(false);

  useEffect(() => {
    const update = () => {
      lastActivity.current = Date.now();
      warned.current = false;
    };
    const events = ["mousemove", "keydown", "pointerdown", "touchstart", "scroll"];
    events.forEach((event) => window.addEventListener(event, update, { passive: true }));
    const timer = window.setInterval(() => {
      const idle = Date.now() - lastActivity.current;
      if (idle >= 30 * 60_000) onTimeout();
      else if (idle >= 28 * 60_000 && !warned.current) {
        warned.current = true;
        onWarning("For security, you will be signed out in about two minutes unless you continue using RouteTrack.");
      }
    }, 15_000);
    return () => {
      window.clearInterval(timer);
      events.forEach((event) => window.removeEventListener(event, update));
    };
  }, [onTimeout, onWarning]);
  return null;
}

export function SecurityPage({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const [items, setItems] = useState<LoginActivityRecord[]>([]);
  useEffect(() => {
    void recordLoginActivity(user);
    return subscribeLoginActivity(user, setItems);
  }, [user]);

  return (
    <div className="page-section security-page">
      <section className="security-hero panel">
        <div><ShieldCheck size={28} /><div><p className="eyebrow">ACCOUNT SECURITY</p><h2>Session and login activity</h2><p>RouteTrack automatically signs out after 30 minutes of inactivity.</p></div></div>
        <button className="secondary-button" onClick={onLogout}><LogOut size={17} /> Sign out now</button>
      </section>
      <section className="security-feature-grid">
        <article><Cloud size={21} /><strong>Offline cache</strong><span>Previously loaded records remain available on supported trusted browsers.</span></article>
        <article><CloudOff size={21} /><strong>Queued synchronization</strong><span>Firestore submits supported offline writes when the connection returns.</span></article>
        <article><ShieldCheck size={21} /><strong>Audit protected</strong><span>Old routing, follow-up, and message records cannot be silently edited or deleted.</span></article>
      </section>
      <section className="panel">
        <div className="panel-heading"><h2>{String(user.role).toLowerCase() === "admin" ? "Recent system logins" : "Your recent logins"}</h2><span>{items.length}</span></div>
        <div className="login-activity-list">
          {items.slice(0, 100).map((item) => <article key={item.id}><div><strong>{item.userName}</strong><span>{item.userEmail}</span></div><div><strong>{formatDateTime(item.createdAt)}</strong><span>{item.userAgent}</span></div></article>)}
          {!items.length && <div className="empty-panel">No login activity recorded yet.</div>}
        </div>
      </section>
    </div>
  );
}
