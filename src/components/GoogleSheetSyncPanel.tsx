"use client";

import { useState } from "react";
import { CheckCircle2, CloudDownload, RefreshCw, ShieldAlert } from "lucide-react";
import { auth } from "@/lib/firebase";
import type { SessionUser } from "@/lib/types";

export function GoogleSheetSyncPanel({ user, notify }: { user: SessionUser; notify: (message: string, error?: boolean) => void }) {
  const [syncing, setSyncing] = useState(false);
  const [summary, setSummary] = useState("");

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
        ok?: boolean; created?: number; updated?: number; skipped?: number; error?: string;
      };
      if (!response.ok || !result.ok) throw new Error(result.error || "Unable to synchronize the Google Sheet.");
      const message = `${result.created || 0} new · ${result.updated || 0} updated · ${result.skipped || 0} skipped`;
      setSummary(`${message} · ${new Date().toLocaleString()}`);
      notify(`Monitoring spreadsheet synchronized: ${message}.`);
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
          <p className="muted">RouteTrack checks the shared monitoring spreadsheet every 15 minutes. Matching is based on document type and document number, so existing records are updated instead of duplicated.</p>
        </div>
        <CloudDownload size={22} />
      </div>
      <div className="import-summary">
        <span><CheckCircle2 size={15} /> Automatic sync is enabled</span>
        {user.role === "admin" && (
          <button className="primary-button" disabled={syncing} onClick={() => void syncNow()}>
            <RefreshCw size={16} className={syncing ? "spin" : ""} /> {syncing ? "Syncing…" : "Sync spreadsheet now"}
          </button>
        )}
      </div>
      {summary && <p className="muted">Last manual sync: {summary}</p>}
      <div className="muted" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
        <ShieldAlert size={15} /> Keep the Google Sheet viewable to the server; otherwise the scheduled sync will report an access error.
      </div>
    </section>
  );
}
