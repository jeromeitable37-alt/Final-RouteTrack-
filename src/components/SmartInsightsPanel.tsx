"use client";

import { AlertTriangle, Clock3, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { DocumentRecord } from "@/lib/types";

function normalize(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function safeDate(value: unknown): Date | null {
  const text = String(value || "").trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function ageInDays(value: unknown): number {
  const date = safeDate(value);
  if (!date) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
}

function requestedDate(item: DocumentRecord): Date | null {
  return safeDate(item.dateRequested || item.dateLogged || item.createdAt);
}

export function SmartInsightsPanel({
  documents,
  onOpenDocument,
}: {
  documents: DocumentRecord[];
  onOpenDocument: (id: string) => void;
}) {
  const active = documents.filter((item) => !item.archivedAt);
  const now = new Date();
  const thisMonth = active.filter((item) => {
    const date = requestedDate(item);
    return date && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  });

  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonth = active.filter((item) => {
    const date = requestedDate(item);
    return date && date.getFullYear() === previous.getFullYear() && date.getMonth() === previous.getMonth();
  });

  const pendingAcknowledgment = active
    .filter((item) => {
      const status = normalize(item.status);
      const closed = status === "completed" || status === "cancelled";
      return !closed && !item.lastReceivedBy && ageInDays(item.lastRoutedAt || item.createdAt) >= 1;
    })
    .sort((a, b) => ageInDays(b.lastRoutedAt || b.createdAt) - ageInDays(a.lastRoutedAt || a.createdAt));

  const stalled = active
    .filter((item) => {
      const status = normalize(item.status);
      const closed = status === "completed" || status === "cancelled";
      return !closed && ageInDays(item.lastRoutedAt || item.updatedAt || item.createdAt) >= 3;
    })
    .sort((a, b) => ageInDays(b.lastRoutedAt || b.updatedAt || b.createdAt) - ageInDays(a.lastRoutedAt || a.updatedAt || a.createdAt));

  const returned = active.filter((item) => normalize(item.status).includes("returned"));
  const missing = active.filter((item) => normalize(item.status) === "missing");

  const holderCounts = new Map<string, number>();
  active.forEach((item) => {
    const status = normalize(item.status);
    if (status === "completed" || status === "cancelled") return;
    const holder = String(item.currentHolder || "Unassigned").trim() || "Unassigned";
    holderCounts.set(holder, (holderCounts.get(holder) || 0) + 1);
  });
  const busiestHolder = [...holderCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  const delta = thisMonth.length - previousMonth.length;
  const priority = missing[0] || returned[0] || pendingAcknowledgment[0] || stalled[0];

  return (
    <section className="panel smart-insights-panel">
      <div className="smart-insights-heading">
        <div>
          <div className="smart-insights-title-row">
            <Sparkles size={18} />
            <p className="eyebrow">SMART INSIGHTS</p>
            <span className="smart-live-badge">Live</span>
          </div>
          <h2>What needs attention today</h2>
          <p>Automatically calculated from the records currently visible to your account.</p>
        </div>
        <div className={`smart-trend ${delta >= 0 ? "trend-up" : "trend-down"}`}>
          {delta >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
          <strong>{Math.abs(delta)}</strong>
          <span>{delta >= 0 ? "more" : "fewer"} than last month</span>
        </div>
      </div>

      <div className="smart-insights-grid">
        <article>
          <span>Pending acknowledgment</span>
          <strong>{pendingAcknowledgment.length}</strong>
          <small>Routed at least one day ago</small>
        </article>
        <article>
          <span>Staying over 3 days</span>
          <strong>{stalled.length}</strong>
          <small>May require a follow-up</small>
        </article>
        <article>
          <span>Returned / Missing</span>
          <strong>{returned.length + missing.length}</strong>
          <small>Needs correction or tracing</small>
        </article>
        <article>
          <span>Current bottleneck</span>
          <strong className="smart-holder-name">{busiestHolder?.[0] || "None"}</strong>
          <small>{busiestHolder ? `${busiestHolder[1]} active file(s)` : "No active documents"}</small>
        </article>
      </div>

      {priority ? (
        <button className="smart-priority-card" onClick={() => onOpenDocument(priority.id)}>
          <span className="smart-priority-icon"><AlertTriangle size={18} /></span>
          <span>
            <small>Recommended first check</small>
            <strong>{priority.type} {priority.requestNo}</strong>
            <em>{priority.status} · Current holder: {priority.currentHolder || "Not recorded"}</em>
          </span>
          <Clock3 size={18} />
        </button>
      ) : (
        <div className="smart-all-clear">
          <Sparkles size={18} /> No urgent document was detected in your current records.
        </div>
      )}
    </section>
  );
}
