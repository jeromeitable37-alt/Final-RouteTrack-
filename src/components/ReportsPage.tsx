"use client";

import { useMemo, useState } from "react";
import { BarChart3, Download, Filter, Timer, TrendingUp } from "lucide-react";
import { DOCUMENT_STATUSES, DOCUMENT_TYPES, DocumentRecord, SessionUser } from "@/lib/types";
import { SpreadsheetImportPanel } from "./SpreadsheetImportPanel";
import { csvDownload, formatCurrency } from "@/lib/utils";

function normalize(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function safeDate(value: unknown): Date | null {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(start: unknown, end: unknown): number {
  const a = safeDate(start);
  const b = safeDate(end);
  if (!a || !b) return 0;
  return Math.max(0, (b.getTime() - a.getTime()) / 86_400_000);
}

export function ReportsPage({
  documents,
  user,
  notify,
  onOpenDocument,
}: {
  documents: DocumentRecord[];
  user: SessionUser;
  notify: (message: string, error?: boolean) => void;
  onOpenDocument: (id: string) => void;
}) {
  const now = new Date();
  const defaultStart = `${now.getFullYear()}-01-01`;
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10));
  const [type, setType] = useState("All");
  const [status, setStatus] = useState("All");
  const [holder, setHolder] = useState("All");

  const holders = useMemo(() => [...new Set(documents.map((item) => item.currentHolder).filter(Boolean))].sort(), [documents]);
  const filtered = useMemo(() => documents.filter((item) => {
    const date = safeDate(item.dateRequested || item.dateLogged || item.createdAt);
    if (!date) return false;
    const dateText = date.toISOString().slice(0, 10);
    return dateText >= startDate && dateText <= endDate
      && (type === "All" || item.type === type)
      && (status === "All" || normalize(item.status) === normalize(status))
      && (holder === "All" || item.currentHolder === holder);
  }), [documents, endDate, holder, startDate, status, type]);

  const completed = filtered.filter((item) => normalize(item.status) === "completed");
  const completionDays = completed.map((item) => daysBetween(item.createdAt, item.completedAt || item.updatedAt)).filter((value) => value >= 0);
  const averageCompletion = completionDays.length ? completionDays.reduce((sum, value) => sum + value, 0) / completionDays.length : 0;
  const totalAmount = filtered.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const returned = filtered.filter((item) => normalize(item.status).includes("returned"));
  const missing = filtered.filter((item) => normalize(item.status) === "missing");
  const workload = Object.entries(filtered.reduce<Record<string, number>>((acc, item) => {
    const key = item.currentHolder || "Not recorded";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const maxWorkload = Math.max(1, ...workload.map(([, count]) => count));
  const typeCounts = DOCUMENT_TYPES.map((documentType) => ({ type: documentType, count: filtered.filter((item) => item.type === documentType).length }));

  function exportReport() {
    csvDownload(`routetrack-report-${startDate}-to-${endDate}.csv`, filtered.map((item) => ({
      Type: item.type,
      Number: item.requestNo,
      "Date requested": item.dateRequested,
      Status: item.status,
      "Current holder": item.currentHolder,
      Supplier: item.supplier || "",
      Requester: item.purchasingEmployee || item.requestor,
      Amount: item.amount || 0,
      "Created by": item.ownerName,
      "Last routed": item.lastRoutedAt || "",
      "Last received by": item.lastReceivedBy || "",
      "Follow-up count": item.followUpCount || 0,
    })));
  }

  return (
    <div className="page-section reports-page">
      <section className="panel report-filter-panel">
        <div className="panel-heading"><div><p className="eyebrow">ENHANCED REPORTS</p><h2>Filter and analyze purchasing documents</h2></div><Filter size={20} /></div>
        <div className="report-filter-grid">
          <label>From<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
          <label>To<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
          <label>Type<select value={type} onChange={(event) => setType(event.target.value)}><option>All</option>{DOCUMENT_TYPES.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option>All</option>{DOCUMENT_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Current holder<select value={holder} onChange={(event) => setHolder(event.target.value)}><option>All</option>{holders.map((item) => <option key={item}>{item}</option>)}</select></label>
          <button className="primary-button" onClick={exportReport}><Download size={17} /> Export report</button>
        </div>
      </section>

      <section className="report-kpi-grid">
        <article><BarChart3 size={20} /><span>Total records</span><strong>{filtered.length}</strong></article>
        <article><TrendingUp size={20} /><span>Completed rate</span><strong>{filtered.length ? Math.round((completed.length / filtered.length) * 100) : 0}%</strong></article>
        <article><Timer size={20} /><span>Average completion</span><strong>{averageCompletion.toFixed(1)} days</strong></article>
        <article><span>Recorded amount</span><strong>{formatCurrency(totalAmount)}</strong><small>{returned.length} returned · {missing.length} missing</small></article>
      </section>

      <section className="reports-grid">
        <article className="panel">
          <div className="panel-heading"><h2>By document type</h2></div>
          <div className="report-type-bars">
            {typeCounts.map((item) => <div key={item.type}><span>{item.type}</span><div><i style={{ width: `${filtered.length ? (item.count / filtered.length) * 100 : 0}%` }} /></div><strong>{item.count}</strong></div>)}
          </div>
        </article>
        <article className="panel">
          <div className="panel-heading"><h2>Current workload by holder</h2></div>
          <div className="workload-bars">
            {workload.map(([name, count]) => <button key={name} onClick={() => setHolder(name)}><div><span>{name}</span><strong>{count}</strong></div><div className="workload-track"><span style={{ width: `${Math.max(6, (count / maxWorkload) * 100)}%` }} /></div></button>)}
          </div>
        </article>
      </section>

      <SpreadsheetImportPanel user={user} existingDocuments={documents} notify={notify} />

      <section className="panel">
        <div className="panel-heading"><h2>Matching documents</h2><span>{filtered.length} result{filtered.length === 1 ? "" : "s"}</span></div>
        <div className="report-document-list">
          {filtered.slice(0, 100).map((item) => <button key={item.id} onClick={() => onOpenDocument(item.id)}><div><strong>{item.type} {item.requestNo}</strong><span>{item.currentHolder}</span></div><span>{item.status}</span></button>)}
          {!filtered.length && <div className="empty-panel">No document matches the selected report filters.</div>}
        </div>
      </section>
    </div>
  );
}
