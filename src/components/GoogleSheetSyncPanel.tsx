"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CloudDownload, RefreshCw, ShieldAlert, Sparkles } from "lucide-react";
import { auth } from "@/lib/firebase";
import type { SessionUser } from "@/lib/types";

interface SyncStatus {
  ok?: boolean;
  latest?: {
    completedAt?: string;
    rawRows?: number;
    uniqueDocuments?: number;
    created?: number;
    updated?: number;
    changed?: number;
    skipped?: number;
    routeChanges?: number;
    statusChanges?: number;
    duplicateMatches?: number;
    ok?: boolean;
  } | null;
  error?: string;
}

export function GoogleSheetSyncPanel({ user, notify }: { user: SessionUser; notify: (message: string, error?: boolean) => void }) {
  const [syncing, setSyncing] = useState(false);
  const [summary, setSummary] = useState("");
  const [status, setStatus] = useState<SyncStatus["latest"]>(null);

  async function loadStatus() {
    if (user.role !== "admin" || !auth?.currentUser) return;
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch("/api/sync/status", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const result = (await response.json().catch(() => ({}))) as SyncStatus;
      if (response.ok && result.ok) setStatus(result.latest || null);
    } catch {
      // Status is informative only; it must not block the page.
    }
  }

  useEffect(() => {
    void loadStatus();
    const timer = window.setInterval(() => void loadStatus(), 30_000);
    return () => window.clearInterval(timer);
  }, [user.role]);

  async function syncNow() {
    if (user.role !== "admin" || !auth?.currentUser) {
      notify("Administrator access is required to synchronize the monitoring spreadsheet.", true);
      return;
    }
    setSyncing(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch("/api/sync/spreadsheet", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean; created?: number; updated?: number; changed?: number; skipped?: number; routeChanges?: number; statusChanges?: number; duplicateMatches?: number; totalRows?: number; error?: string;
      };
      if (!response.ok || !result.ok) throw new Error(result.error || "Unable to synchronize the Google Sheet.");
      const message = `${result.created || 0} new · ${result.updated || 0} updated · ${result.changed || 0} changed · ${result.routeChanges || 0} route changes`;
      setSummary(`${message} · ${new Date().toLocaleString()}`);
      notify(`Monitoring spreadsheet synchronized: ${message}.`);
      await loadStatus();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to synchronize the Google Sheet.", true);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">LIVE MONITORING SOURCE</p>
          <h2>Google Sheets automatic sync</h2>
          <p className="muted">The sheet is treated as a live monitoring source. RouteTrack compares it with existing records, avoids duplicate documents, updates changed fields, detects routing/status changes, and recalculates the dashboard from the synchronized Firestore records.</p>
        </div>
        <CloudDownload size={22} />
      </div>
      <div className="import-summary" style={{ flexWrap: "wrap" }}>
        <span><CheckCircle2 size={15} /> Spreadsheet connection is working</span>
        {user.role === "admin" && (
          <button className="primary-button" disabled={syncing} onClick={() => void syncNow()}>
            <RefreshCw size={16} className={syncing ? "spin" : ""} /> {syncing ? "Syncing…" : "Sync spreadsheet now"}
          </button>
        )}
      </div>
      {status && (
        <div className="muted" style={{ display: "grid", gap: 6, marginTop: 10 }}>
          <strong>Last automatic sync: {status.completedAt ? new Date(status.completedAt).toLocaleString() : "Not yet recorded"}</strong>
          <span>{status.uniqueDocuments ?? status.rawRows ?? 0} unique documents · {status.created ?? 0} created · {status.updated ?? 0} updated · {status.changed ?? 0} changed · {status.routeChanges ?? 0} route changes · {status.duplicateMatches ?? 0} duplicate matches handled</span>
        </div>
      )}
      {summary && <p className="muted">Last manual sync: {summary}</p>}
      <div className="muted" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
        <Sparkles size={15} /> Auto-checking is derived from the latest synchronized status, holder, timing, acknowledgment, and spreadsheet changes.
      </div>
      <div className="muted" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
        <ShieldAlert size={15} /> Keep the Google Sheet viewable to the server; otherwise the scheduled sync will report an access error.
      </div>
    </section>
  );
}
