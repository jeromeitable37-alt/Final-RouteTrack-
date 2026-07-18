"use client";

import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  Bot,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileWarning,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { ActivityRecord, DocumentRecord, SessionUser } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { nextRouteSuggestions } from "@/lib/workflow";

function normalize(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function ageDays(value: unknown): number {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
}

function label(item: DocumentRecord): string {
  return `${item.type} ${item.requestNo}`;
}

export function ModernOperationsPanel({
  documents,
  activities,
  user,
  unreadMessages,
  onOpenDocument,
  onOpenMessages,
  onOpenAlerts,
}: {
  documents: DocumentRecord[];
  activities: ActivityRecord[];
  user: SessionUser;
  unreadMessages: number;
  onOpenDocument: (id: string) => void;
  onOpenMessages: () => void;
  onOpenAlerts: () => void;
}) {
  const active = documents.filter((item) => {
    const status = normalize(item.status);
    return !item.archivedAt && status !== "completed" && status !== "cancelled";
  });

  const missing = active.filter((item) => normalize(item.status) === "missing");
  const returned = active.filter((item) => normalize(item.status).includes("returned"));
  const pendingAcknowledgment = active.filter(
    (item) => item.lastRoutedAt && !item.lastReceivedBy && ageDays(item.lastRoutedAt) >= 1,
  );
  const overdue = active.filter((item) => {
    const allowed = Number(item.slaDays || 3);
    return ageDays(item.lastRoutedAt || item.updatedAt || item.createdAt) > allowed;
  });
  const followUpsDue = active.filter((item) => {
    if (!item.nextFollowUpAt) return false;
    const due = new Date(item.nextFollowUpAt);
    return !Number.isNaN(due.getTime()) && due.getTime() <= Date.now();
  });

  const priority = missing[0] || returned[0] || followUpsDue[0] || pendingAcknowledgment[0] || overdue[0] || active[0];
  const priorityReason = missing[0]
    ? "marked Missing"
    : returned[0]
      ? "returned for correction"
      : followUpsDue[0]
        ? "follow-up is due"
        : pendingAcknowledgment[0]
          ? "still has no acknowledgment"
          : overdue[0]
            ? "has exceeded its expected holding time"
            : "is the most recent active record";

  const workload = Object.entries(
    active.reduce<Record<string, number>>((acc, item) => {
      const holder = item.currentHolder || "Not recorded";
      acc[holder] = (acc[holder] || 0) + 1;
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const maximum = Math.max(1, ...workload.map(([, count]) => count));

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? "Good morning" : greetingHour < 18 ? "Good afternoon" : "Good evening";
  const firstName = (user.displayName || "User").split(" ")[0];
  const taskCount = missing.length + returned.length + pendingAcknowledgment.length + followUpsDue.length;

  return (
    <section className="modern-operations-grid">
      <article className="daily-briefing-card">
        <div className="daily-briefing-icon"><Sparkles size={22} /></div>
        <div className="daily-briefing-copy">
          <p className="eyebrow">SMART DAILY BRIEFING</p>
          <h2>{greeting}, {firstName}.</h2>
          <p>
            You have <strong>{taskCount} action item{taskCount === 1 ? "" : "s"}</strong>, {overdue.length} overdue file{overdue.length === 1 ? "" : "s"}, and {unreadMessages} unread message{unreadMessages === 1 ? "" : "s"}.
          </p>
          {priority ? (
            <button className="briefing-priority" onClick={() => onOpenDocument(priority.id)}>
              <Bot size={17} />
              <span><small>Recommended first action</small><strong>Check {label(priority)} because it {priorityReason}.</strong></span>
              <ArrowRight size={17} />
            </button>
          ) : (
            <div className="briefing-clear"><CheckCircle2 size={18} /> No active document requires attention.</div>
          )}
        </div>
      </article>

      <article className="my-tasks-card panel">
        <div className="panel-heading"><div><p className="eyebrow">MY TASKS TODAY</p><h2>Action queue</h2></div><button className="text-button" onClick={onOpenAlerts}>Open all</button></div>
        <div className="task-tile-grid">
          <TaskTile icon={<FileWarning size={19} />} label="Missing" value={missing.length} tone="danger" />
          <TaskTile icon={<AlertTriangle size={19} />} label="Returned" value={returned.length} tone="warning" />
          <TaskTile icon={<BellRing size={19} />} label="No acknowledgment" value={pendingAcknowledgment.length} tone="warning" />
          <TaskTile icon={<CalendarClock size={19} />} label="Follow-up due" value={followUpsDue.length} tone="info" />
        </div>
        <div className="task-document-list">
          {[...missing, ...returned, ...followUpsDue, ...pendingAcknowledgment]
            .filter((item, index, array) => array.findIndex((candidate) => candidate.id === item.id) === index)
            .slice(0, 5)
            .map((item) => (
              <button key={item.id} onClick={() => onOpenDocument(item.id)}>
                <div><strong>{label(item)}</strong><span>{item.currentHolder || "No holder recorded"}</span></div>
                <span>{ageDays(item.lastRoutedAt || item.updatedAt || item.createdAt)}d</span>
              </button>
            ))}
          {!taskCount && <div className="empty-panel compact-empty">Your action queue is clear.</div>}
        </div>
      </article>

      <article className="workload-card panel">
        <div className="panel-heading"><div><p className="eyebrow">LIVE WORKLOAD</p><h2>Current holders</h2></div><Building2 size={20} /></div>
        <div className="workload-bars">
          {workload.map(([holder, count]) => (
            <div key={holder}>
              <div><span>{holder}</span><strong>{count}</strong></div>
              <div className="workload-track"><span style={{ width: `${Math.max(7, (count / maximum) * 100)}%` }} /></div>
            </div>
          ))}
          {!workload.length && <div className="empty-panel compact-empty">No active workload.</div>}
        </div>
      </article>

      <article className="activity-feed-card panel">
        <div className="panel-heading"><div><p className="eyebrow">LIVE ACTIVITY</p><h2>Recent updates</h2></div><Clock3 size={20} /></div>
        <div className="compact-activity-feed">
          {activities.slice(0, 6).map((item) => (
            <article key={item.id}>
              <div className="activity-feed-dot" />
              <div><strong>{item.summary}</strong><span>{item.actorName} · {formatDateTime(item.createdAt)}</span></div>
            </article>
          ))}
          {!activities.length && <div className="empty-panel compact-empty">No recent activity.</div>}
        </div>
        <button className="secondary-button full-button" onClick={onOpenMessages}><MessageCircle size={16} /> Open team messages {unreadMessages > 0 ? `(${unreadMessages})` : ""}</button>
      </article>

      {priority && !["CRF", "PO"].includes(priority.type) && (
        <article className="route-recommendation-card panel">
          <div className="panel-heading"><div><p className="eyebrow">SMART ROUTE SUGGESTION</p><h2>{label(priority)}</h2></div><Bot size={20} /></div>
          <p>Based on the current holder and your configured workflow, the likely next destination is:</p>
          <button onClick={() => onOpenDocument(priority.id)}>
            <strong>{nextRouteSuggestions(priority)[0] || "Review the routing history"}</strong>
            <span>Open the document to confirm before recording the route.</span>
          </button>
        </article>
      )}
    </section>
  );
}

function TaskTile({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return <article className={`task-tile task-${tone}`}><div>{icon}</div><span>{label}</span><strong>{value}</strong></article>;
}
