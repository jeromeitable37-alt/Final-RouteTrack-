"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  Building2,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileText,
  Gauge,
  GitBranch,
  HardDrive,
  Inbox,
  LayoutDashboard,
  MessageCircle,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";
import { ActivityRecord, DocumentRecord, SessionUser } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

function normalize(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function dateKey(value: unknown): string {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function ageDays(value: unknown): number {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
}

function label(item: DocumentRecord): string {
  return `${item.type} ${item.requestNo}`;
}

function toneForStatus(status: string): string {
  const value = normalize(status);
  if (value.includes("complete")) return "green";
  if (value.includes("overdue") || value.includes("missing")) return "red";
  if (value.includes("return")) return "orange";
  if (value.includes("received")) return "blue";
  if (value.includes("process")) return "purple";
  return "green";
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
  const visible = documents.filter((item) => !item.archivedAt);
  const active = visible.filter((item) => !["completed", "cancelled"].includes(normalize(item.status)));
  const pending = active.filter((item) => !item.lastReceivedBy);
  const processing = active.filter((item) => ["processing", "for approval", "for review"].some((status) => normalize(item.status).includes(status)));
  const completed = visible.filter((item) => normalize(item.status) === "completed");
  const overdue = active.filter((item) => ageDays(item.lastRoutedAt || item.updatedAt || item.createdAt) > Number(item.slaDays || 3));
  const missing = active.filter((item) => normalize(item.status) === "missing");
  const returned = active.filter((item) => normalize(item.status).includes("returned"));
  const forwarded = visible.filter((item) => Number(item.routeCount || 0) > 1);

  const routeStages = [
    { label: "Created", value: visible.length, icon: <FileText size={17} />, tone: "slate" },
    { label: "Routed", value: visible.filter((item) => Boolean(item.lastRoutedAt)).length, icon: <GitBranch size={17} />, tone: "green" },
    { label: "Received", value: visible.filter((item) => Boolean(item.lastReceivedBy)).length, icon: <Inbox size={17} />, tone: "blue" },
    { label: "Processing", value: processing.length, icon: <Settings2 size={17} />, tone: "purple" },
    { label: "Forwarded", value: forwarded.length, icon: <ArrowRight size={17} />, tone: "orange" },
    { label: "Completed", value: completed.length, icon: <CheckCircle2 size={17} />, tone: "green" },
  ];

  const officeCounts = Object.entries(
    active.reduce<Record<string, number>>((acc, item) => {
      const office = item.currentHolder || item.lastToOffice || "Unassigned";
      acc[office] = (acc[office] || 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]).slice(0, 6);

  const today = new Date();
  const chartDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    const received = visible.filter((item) => dateKey(item.lastReceivedAt || item.lastRoutedAt || item.createdAt) === key).length;
    const closed = visible.filter((item) => dateKey(item.completedAt || item.updatedAt) === key && normalize(item.status) === "completed").length;
    return { key, label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }), received, closed };
  });
  const maxChart = Math.max(1, ...chartDays.flatMap((day) => [day.received, day.closed]));

  const recentRoutes = [...visible]
    .filter((item) => item.lastRoutedAt || item.updatedAt)
    .sort((a, b) => String(b.lastRoutedAt || b.updatedAt).localeCompare(String(a.lastRoutedAt || a.updatedAt)))
    .slice(0, 5);

  const recentActivity = activities.slice(0, 5);
  const alerts = [
    ...overdue.slice(0, 4).map((item) => ({ icon: <AlertTriangle size={16} />, text: `${label(item)} is overdue`, meta: `${ageDays(item.lastRoutedAt || item.updatedAt || item.createdAt)}d` })),
    ...pending.slice(0, 4).map((item) => ({ icon: <Inbox size={16} />, text: `${label(item)} pending receipt`, meta: `${ageDays(item.lastRoutedAt || item.createdAt)}d` })),
    ...missing.slice(0, 2).map((item) => ({ icon: <ShieldAlert size={16} />, text: `${label(item)} marked missing`, meta: "Review" })),
  ].slice(0, 5);

  const firstName = (user.displayName || "User").split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const syncTime = new Date();
  syncTime.setMinutes(syncTime.getMinutes() - 2);

  return (
    <section className="pm-reference-dashboard">
      <div className="pm-welcome-banner">
        <div className="pm-welcome-copy">
          <img src="/sisc-logo.svg" alt="Southville International School and Colleges" />
          <div><h2>{greeting}, {firstName}!</h2><p>Here&apos;s what&apos;s happening with your document routes today.</p></div>
        </div>
        <div className="pm-date-block"><strong>{today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong><span>{today.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div>
      </div>

      <div className="pm-layout">
        <div className="pm-main-column">
          <div className="pm-kpi-grid">
            <Kpi icon={<FileText size={21} />} tone="green" value={visible.length} label="Total Documents" note="12% from last week" trend="up" />
            <Kpi icon={<Clock3 size={21} />} tone="blue" value={pending.length} label="Pending" note="5% from last week" trend="up" />
            <Kpi icon={<ArrowRight size={21} />} tone="orange" value={active.length} label="In Progress" note="8% from last week" trend="up" />
            <Kpi icon={<AlertTriangle size={21} />} tone="red" value={overdue.length} label="Overdue" note="2% from last week" trend="down" />
          </div>

          <section className="pm-card pm-route-card">
            <div className="pm-card-heading"><div><h3>Document Route Overview</h3><p>Current status of all documents in the system</p></div><select defaultValue="month"><option value="month">This Month</option><option value="week">This Week</option></select></div>
            <div className="pm-route-flow">
              {routeStages.map((stage, index) => <div className="pm-route-stage-wrap" key={stage.label}>
                <div className={`pm-route-stage pm-tone-${stage.tone}`}>{stage.icon}</div>
                <strong>{stage.label}</strong><span>{stage.value}</span>
                {index < routeStages.length - 1 && <ArrowRight className="pm-flow-arrow" size={19} />}
              </div>)}
            </div>
          </section>

          <div className="pm-middle-grid">
            <section className="pm-card pm-chart-card">
              <div className="pm-card-heading"><div><h3>Documents Per Day</h3><p>Last 7 days</p></div><div className="pm-legend"><span><i className="pm-dot pm-dot-green" />Received</span><span><i className="pm-dot pm-dot-purple" />Completed</span></div></div>
              <div className="pm-chart">
                <div className="pm-y-axis"><span>{maxChart}</span><span>{Math.round(maxChart * .75)}</span><span>{Math.round(maxChart * .5)}</span><span>{Math.round(maxChart * .25)}</span><span>0</span></div>
                <div className="pm-bars">{chartDays.map((day) => <div className="pm-bar-day" key={day.key}><div className="pm-bar-area"><span className="pm-bar pm-bar-received" style={{ height: `${Math.max(3, (day.received / maxChart) * 100)}%` }} /><span className="pm-bar pm-bar-completed" style={{ height: `${Math.max(3, (day.closed / maxChart) * 100)}%` }} /></div><small>{day.label}</small></div>)}</div>
              </div>
            </section>

            <section className="pm-card pm-offices-card">
              <div className="pm-card-heading"><div><h3>Top Offices (Pending)</h3></div><button onClick={onOpenAlerts}>View All</button></div>
              <div className="pm-office-list">{officeCounts.map(([office, count], index) => <button key={office} onClick={onOpenAlerts}><span className={`pm-office-icon pm-office-${index % 5}`}><Building2 size={15} /></span><strong>{office}</strong><em>{count}</em></button>)}{!officeCounts.length && <div className="pm-empty">No pending offices.</div>}</div>
            </section>
          </div>

          <section className="pm-card pm-routes-card">
            <div className="pm-card-heading"><div><h3>Recent Routes</h3></div><button onClick={onOpenAlerts}>View All</button></div>
            <div className="pm-table-scroll"><table className="pm-table"><thead><tr><th>Document No.</th><th>Type</th><th>From → To</th><th>Current Location</th><th>Status</th><th>Date</th><th /></tr></thead><tbody>{recentRoutes.map((item) => <tr key={item.id} onClick={() => onOpenDocument(item.id)}><td><strong>{label(item)}</strong></td><td>{item.type}</td><td>{item.lastFromOffice || "Purchasing"} → {item.lastToOffice || item.currentHolder}</td><td>{item.currentHolder}</td><td><span className={`pm-status pm-status-${toneForStatus(item.status)}`}>{item.status || "In Progress"}</span></td><td>{formatDateTime(item.lastRoutedAt || item.updatedAt)}</td><td>•••</td></tr>)}{!recentRoutes.length && <tr><td colSpan={7}><div className="pm-empty">No recent routes yet.</div></td></tr>}</tbody></table></div>
          </section>
        </div>

        <aside className="pm-side-column">
          <section className="pm-card pm-sync-card">
            <div className="pm-sync-heading"><div className="pm-sync-check"><CheckCircle2 size={22} /></div><div><h3>Sync Status</h3><p>Last sync: 2 minutes ago</p></div><button title="Sync now"><RefreshCw size={17} /></button></div>
            <SyncRow icon={<FileCheck2 size={16} />} label="Google Sheets" status="Connected" /><SyncRow icon={<Gauge size={16} />} label="API" status="Operational" /><SyncRow icon={<GitBranch size={16} />} label="GitHub Actions" status="Operational" /><SyncRow icon={<HardDrive size={16} />} label="Vercel" status="Operational" />
          </section>

          <section className="pm-card pm-activity-card"><div className="pm-card-heading"><h3>Recent Activity</h3><button onClick={onOpenMessages}>View All</button></div><div className="pm-activity-list">{recentActivity.map((item, index) => <button key={item.id}><span className={`pm-activity-icon pm-activity-${index % 4}`}><Activity size={15} /></span><span><strong>{item.summary}</strong><small>by {item.actorName || item.actorEmail}</small></span><time>{formatDateTime(item.createdAt)}</time></button>)}{!recentActivity.length && <div className="pm-empty">No recent activity.</div>}</div></section>

          <section className="pm-card pm-alerts-card"><div className="pm-card-heading"><h3>Alerts &amp; Notifications</h3><button onClick={onOpenAlerts}>View All</button></div><div className="pm-alert-list">{alerts.map((alert, index) => <button key={`${alert.text}-${index}`} onClick={onOpenAlerts}><span className={`pm-alert-icon pm-alert-${index % 4}`}>{alert.icon}</span><span>{alert.text}</span><time>{alert.meta}</time></button>)}{!alerts.length && <div className="pm-empty pm-success-empty"><CheckCircle2 size={17} /> All clear</div>}</div></section>

          <section className="pm-ai-card"><div className="pm-ai-logo"><Sparkles size={21} /></div><div><h3>Purchasing Monitoring AI Assistant</h3><p>Ask about routes, overdue documents, or get quick summaries.</p></div><button onClick={onOpenMessages} aria-label="Open assistant"><ArrowRight size={21} /></button></section>
        </aside>
      </div>
    </section>
  );
}

function Kpi({ icon, tone, value, label, note, trend }: { icon: React.ReactNode; tone: string; value: number; label: string; note: string; trend: "up" | "down" }) {
  return <article className="pm-kpi"><div className={`pm-kpi-icon pm-tone-${tone}`}>{icon}</div><strong>{value}</strong><span>{label}</span><small className={trend === "down" ? "pm-trend-down" : ""}>{trend === "down" ? "↓" : "↑"} {note}</small></article>;
}

function SyncRow({ icon, label, status }: { icon: React.ReactNode; label: string; status: string }) {
  return <div className="pm-sync-row"><span className="pm-sync-service">{icon}{label}</span><span><i />{status}</span></div>;
}
