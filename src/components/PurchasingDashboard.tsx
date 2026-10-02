"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileCheck2,
  FileText,
  GitBranch,
  Inbox,
  PackageCheck,
  QrCode,
  RefreshCw,
  Send,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { ActivityRecord, DocumentRecord, SessionUser } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

function norm(value: unknown) { return String(value || "").trim().toLowerCase(); }
function ageDays(value: unknown) {
  const t = new Date(String(value || "")).getTime();
  return Number.isFinite(t) ? Math.max(0, Math.floor((Date.now() - t) / 86400000)) : 0;
}
function label(d: DocumentRecord) { return `${d.type}-${d.requestNo}`; }

export function PurchasingDashboard({
  documents,
  activities,
  user,
  unreadMessages,
  onOpenDocument,
  onOpenRoutes,
  onOpenDocuments,
  onOpenAlerts,
}: {
  documents: DocumentRecord[];
  activities: ActivityRecord[];
  user: SessionUser;
  unreadMessages: number;
  onOpenDocument: (id: string) => void;
  onOpenRoutes: () => void;
  onOpenDocuments: () => void;
  onOpenAlerts: () => void;
}) {
  const active = documents.filter(d => !d.archivedAt && !["completed", "cancelled"].includes(norm(d.status)));
  const pending = documents.filter(d => ["pending", "for approval", "in transit", "processing", "routed", "received"].includes(norm(d.status)));
  const completed = documents.filter(d => norm(d.status) === "completed");
  const overdue = active.filter(d => ageDays(d.lastRoutedAt || d.updatedAt || d.createdAt) > Number(d.slaDays || 3));
  const noReceipt = active.filter(d => d.lastRoutedAt && !d.lastReceivedBy);
  const today = new Date().toISOString().slice(0, 10);
  const routedToday = documents.filter(d => String(d.lastRoutedAt || d.createdAt).slice(0, 10) === today);
  const received = documents.filter(d => Boolean(d.lastReceivedBy || d.lastReceivedAt));

  const officeRows = useMemo(() => {
    const counts = new Map<string, number>();
    active.forEach(d => counts.set(d.currentHolder || "Unassigned", (counts.get(d.currentHolder || "Unassigned") || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [active]);
  const maxOffice = Math.max(1, ...officeRows.map(([, n]) => n));

  const routeStages = [
    ["Created", documents.length],
    ["Routed", documents.filter(d => Boolean(d.lastRoutedAt)).length],
    ["Received", received.length],
    ["Processing", active.filter(d => ["processing", "received", "in transit"].includes(norm(d.status))).length],
    ["Forwarded", documents.filter(d => Boolean(d.routeCount && d.routeCount > 1)).length],
    ["Completed", completed.length],
  ];

  const daily = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      return { key: d.toISOString().slice(0, 10), label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), received: 0, completed: 0 };
    });
    documents.forEach(doc => {
      const key = String(doc.lastRoutedAt || doc.createdAt || "").slice(0, 10);
      const row = days.find(x => x.key === key);
      if (!row) return;
      row.received += 1;
      if (norm(doc.status) === "completed") row.completed += 1;
    });
    return days;
  }, [documents]);
  const maxDay = Math.max(1, ...daily.flatMap(d => [d.received, d.completed]));

  return (
    <div className="purchase-dashboard">
      <section className="purchase-hero">
        <div>
          <p className="purchase-kicker">PURCHASING OFFICE · DOCUMENT CONTROL</p>
          <h2>Good morning, {user.displayName?.split(" ")[0] || "Jerome"}!</h2>
          <p>Here's what's happening with your document routes today.</p>
        </div>
        <div className="purchase-date"><strong>{new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong><span>{new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span></div>
      </section>

      <section className="purchase-metrics">
        <MetricCard icon={<FileText />} tone="green" value={documents.length} label="Total Documents" change="Active records" />
        <MetricCard icon={<Clock3 />} tone="blue" value={pending.length} label="Pending" change={`${noReceipt.length} awaiting receipt`} />
        <MetricCard icon={<Send />} tone="orange" value={active.length} label="In Progress" change={`${routedToday.length} routed today`} />
        <MetricCard icon={<ShieldAlert />} tone="red" value={overdue.length} label="Overdue" change={overdue.length ? "Needs attention" : "All within SLA"} />
      </section>

      <div className="purchase-main-grid">
        <div className="purchase-primary-column">
          <section className="purchase-panel route-overview-panel">
            <PanelHeading title="Document Route Overview" subtitle="Current status of all documents in the system" action={<select defaultValue="month"><option value="month">This Month</option><option value="week">This Week</option></select>} />
            <div className="route-stepper">
              {routeStages.map(([name, count], i) => <div className="route-step-wrap" key={String(name)}><div className={`route-step route-step-${i}`}><span>{i === 0 ? <FileText /> : i === 5 ? <Check /> : i === 1 || i === 2 ? <GitBranch /> : <PackageCheck />}</span></div><strong>{name}</strong><b>{count}</b>{i < routeStages.length - 1 && <ArrowRight className="route-arrow" />}</div>)}
            </div>
          </section>

          <div className="purchase-two-col">
            <section className="purchase-panel chart-panel">
              <PanelHeading title="Documents Per Day" subtitle="Last 7 days" action={<div className="chart-legend"><span><i className="legend-received" /> Received</span><span><i className="legend-completed" /> Completed</span></div>} />
              <div className="purchase-chart">
                <div className="chart-y"><span>{maxDay}</span><span>{Math.round(maxDay * .75)}</span><span>{Math.round(maxDay * .5)}</span><span>{Math.round(maxDay * .25)}</span><span>0</span></div>
                <div className="chart-bars">{daily.map(d => <div className="chart-day" key={d.key}><div className="bar-pair"><i style={{ height: `${(d.received / maxDay) * 100}%` }} /><i style={{ height: `${(d.completed / maxDay) * 100}%` }} /></div><span>{d.label}</span></div>)}</div>
              </div>
            </section>

            <section className="purchase-panel offices-panel">
              <PanelHeading title="Top Offices (Pending)" subtitle="" action={<button onClick={onOpenDocuments}>View All</button>} />
              <div className="office-list">{officeRows.length ? officeRows.map(([office, count], i) => <button key={office} onClick={onOpenDocuments}><span className={`office-dot office-dot-${i % 5}`}><Building2 /></span><strong>{office}</strong><b>{count}</b><div className="office-mini-bar"><i style={{ width: `${(count / maxOffice) * 100}%` }} /></div></button>) : <div className="purchase-empty">No pending offices.</div>}</div>
            </section>
          </div>

          <section className="purchase-panel recent-routes-panel">
            <PanelHeading title="Recent Routes" subtitle="" action={<button onClick={onOpenRoutes}>View All</button>} />
            <div className="purchase-table-wrap"><table className="purchase-table"><thead><tr><th>Document No.</th><th>Type</th><th>From → To</th><th>Current Location</th><th>Status</th><th>Date</th><th /></tr></thead><tbody>{documents.slice().sort((a,b)=>String(b.lastRoutedAt||b.createdAt).localeCompare(String(a.lastRoutedAt||a.createdAt))).slice(0,6).map(d => <tr key={d.id} onClick={() => onOpenDocument(d.id)}><td><strong>{d.type}-{d.requestNo}</strong></td><td>{d.type}</td><td>{d.lastFromOffice || "Purchasing"} → {d.lastToOffice || d.currentHolder}</td><td>{d.currentHolder}</td><td><span className={`purchase-status ps-${norm(d.status).replaceAll(" ", "-")}`}>{d.status}</span></td><td>{formatDateTime(d.lastRoutedAt || d.createdAt)}</td><td><ChevronRight size={16} /></td></tr>)}</tbody></table></div>
          </section>
        </div>

        <aside className="purchase-side-column">
          <section className="purchase-panel sync-panel"><div className="sync-head"><div className="sync-check"><Check /></div><div><strong>Sync Status</strong><span>Last sync: 2 minutes ago</span></div><button onClick={() => window.location.reload()}><RefreshCw size={15} /> Sync Now</button></div><div className="sync-list"><SyncRow icon={<FileText />} label="Google Sheets" status="Connected" /><SyncRow icon={<GitBranch />} label="API" status="Operational" /><SyncRow icon={<GitBranch />} label="GitHub Actions" status="Operational" /><SyncRow icon={<CheckCircle2 />} label="Vercel" status="Operational" /></div></section>

          <section className="purchase-panel activity-panel"><PanelHeading title="Recent Activity" subtitle="" action={<button onClick={onOpenDocuments}>View All</button>} /><div className="purchase-activity">{activities.slice(0, 5).map((a, i) => <button key={a.id} onClick={() => a.documentId && onOpenDocument(a.documentId)}><span className={`activity-dot activity-dot-${i % 4}`}><Inbox /></span><div><strong>{a.summary}</strong><small>by {a.actorName || "System"}</small></div><time>{formatRelative(a.createdAt)}</time></button>)}{!activities.length && <div className="purchase-empty">No recent activity.</div>}</div></section>

          <section className="purchase-panel alerts-panel"><PanelHeading title="Alerts & Notifications" subtitle="" action={<button onClick={onOpenAlerts}>View All</button>} /><div className="purchase-alerts">{overdue.slice(0, 2).map(d => <button key={d.id} onClick={() => onOpenDocument(d.id)}><span className="alert-icon-small"><AlertTriangle /></span><strong>{label(d)} is overdue</strong><time>{formatRelative(d.lastRoutedAt || d.updatedAt)}</time></button>)}{noReceipt.slice(0, 2).map(d => <button key={`r-${d.id}`} onClick={() => onOpenDocument(d.id)}><span className="alert-icon-small"><Bell /></span><strong>{label(d)} pending receipt</strong><time>{formatRelative(d.lastRoutedAt)}</time></button>)}{!overdue.length && !noReceipt.length && <div className="purchase-alert-clear"><CheckCircle2 /> No critical alerts</div>}</div></section>

          <button className="purchase-ai-card" onClick={onOpenAlerts}><div className="ai-logo"><img src="/sisc-logo.svg" alt="SISC" /></div><div><strong>RouteTrack AI Assistant</strong><span>Ask about routes, overdue documents, or get quick summaries.</span></div><span className="ai-arrow"><ArrowRight /></span></button>
        </aside>
      </div>
    </div>
  );
}

function MetricCard({ icon, tone, value, label, change }: { icon: React.ReactNode; tone: string; value: number; label: string; change: string }) {
  return <article className="purchase-metric"><span className={`metric-icon metric-${tone}`}>{icon}</span><strong>{value}</strong><b>{label}</b><small className={`metric-change change-${tone}`}>{change}</small></article>;
}
function PanelHeading({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return <div className="purchase-panel-heading"><div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>{action}</div>;
}
function SyncRow({ icon, label, status }: { icon: React.ReactNode; label: string; status: string }) { return <div className="sync-row"><span>{icon}</span><b>{label}</b><i /><small>{status}</small></div>; }
function formatRelative(value: unknown) { const t = new Date(String(value || "")).getTime(); if (!Number.isFinite(t)) return "—"; const m = Math.max(0, Math.floor((Date.now() - t) / 60000)); if (m < 1) return "now"; if (m < 60) return `${m}m ago`; const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`; return `${Math.floor(h / 24)}d ago`; }
