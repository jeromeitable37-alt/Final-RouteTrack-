import { DocumentRecord, DocumentStatus } from "./types";

export function todayInput(): string {
  return new Date().toISOString().slice(0, 10);
}

export function nowLocalInput(): string {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export function formatDate(value: string): string {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export function isClosed(status: DocumentStatus): boolean {
  return status === "Completed" || status === "Cancelled";
}

export function isOverdue(document: DocumentRecord): boolean {
  if (!document.dueDate || isClosed(document.status)) return false;
  return new Date(`${document.dueDate}T23:59:59`).getTime() < Date.now();
}

export function daysOpen(document: DocumentRecord): number {
  const start = new Date(`${document.dateLogged || document.createdAt.slice(0, 10)}T00:00:00`);
  const end = isClosed(document.status) ? new Date(document.updatedAt) : new Date();
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000));
}

export function trackingId(type: string): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const tail = now.getTime().toString().slice(-5);
  return `${type}-${date}-${tail}`;
}

export function statusClass(status: DocumentStatus): string {
  return `status status-${status.toLowerCase().replaceAll(" ", "-")}`;
}

export function csvDownload(filename: string, rows: Array<Record<string, unknown>>): void {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [headers.map(escape).join(","), ...rows.map((row) => headers.map((h) => escape(row[h])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
