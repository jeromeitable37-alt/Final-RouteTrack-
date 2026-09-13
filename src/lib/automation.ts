import { DocumentRecord } from "@/lib/types";

export type AutomationPriority = "critical" | "high" | "medium" | "low" | "clear";

export interface AutomationCheck {
  needsAttention: boolean;
  priority: AutomationPriority;
  reasons: string[];
  recommendation: string;
  ageDays: number;
  overdue: boolean;
  pendingAcknowledgment: boolean;
  returned: boolean;
  missing: boolean;
  recentlyChanged: boolean;
  newFromSpreadsheet: boolean;
}

function normalize(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function safeDate(value: unknown): Date | null {
  const text = String(value || "").trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function ageDays(value: unknown, now = Date.now()): number {
  const date = safeDate(value);
  if (!date) return 0;
  return Math.max(0, Math.floor((now - date.getTime()) / 86_400_000));
}

export function analyzeDocument(item: DocumentRecord, now = Date.now()): AutomationCheck {
  const status = normalize(item.status);
  const closed = status === "completed" || status === "cancelled";
  const returned = status.includes("returned");
  const missing = status === "missing";
  const lastActivity = item.lastRoutedAt || item.updatedAt || item.createdAt;
  const age = ageDays(lastActivity, now);
  const pendingAcknowledgment = !closed && Boolean(item.lastRoutedAt) && !item.lastReceivedBy && ageDays(item.lastRoutedAt, now) >= 1;
  const overdue = !closed && age > Number(item.slaDays || 3);
  const recentlyChanged = Boolean(item.spreadsheetChangedAt) && ageDays(item.spreadsheetChangedAt, now) <= 1;
  const newFromSpreadsheet = item.syncSource === "google-sheet" && Boolean(item.spreadsheetSyncAt) && String(item.createdAt || "") === String(item.spreadsheetSyncAt || "");

  const reasons: string[] = [];
  if (missing) reasons.push("Document is marked Missing.");
  if (returned) reasons.push("Document was returned for correction.");
  if (pendingAcknowledgment) reasons.push("A routed document has not been acknowledged for at least one day.");
  if (overdue) reasons.push(`Document has remained active for about ${age} days, beyond the configured SLA.`);
  if (recentlyChanged) reasons.push("The monitoring spreadsheet changed this document recently.");
  if (newFromSpreadsheet) reasons.push("New document detected from the monitoring spreadsheet.");

  let priority: AutomationPriority = "clear";
  if (missing) priority = "critical";
  else if (returned || overdue) priority = "high";
  else if (pendingAcknowledgment || recentlyChanged) priority = "medium";
  else if (newFromSpreadsheet) priority = "low";

  let recommendation = "No immediate action detected.";
  if (missing) recommendation = "Locate and verify the physical document, then update its status.";
  else if (returned) recommendation = "Review the correction request and route the document to the required office.";
  else if (pendingAcknowledgment) recommendation = "Verify whether the receiving office has the document and record the acknowledgment.";
  else if (overdue) recommendation = "Check the current holder and follow up on the document.";
  else if (recentlyChanged) recommendation = `Review the latest spreadsheet change for ${item.currentHolder || "the current holder"}.`;
  else if (newFromSpreadsheet) recommendation = "Verify the new record and follow the suggested next route.";
  else if (status === "for routing") recommendation = "Prepare the document for its suggested next route.";
  else if (status === "in transit") recommendation = `Monitor the handoff to ${item.currentHolder || "the receiving office"}.`;
  else if (status === "received" || status === "under review" || status === "for approval") recommendation = `Check progress with ${item.currentHolder || "the current holder"}.`;

  return {
    needsAttention: reasons.length > 0,
    priority,
    reasons,
    recommendation,
    ageDays: age,
    overdue,
    pendingAcknowledgment,
    returned,
    missing,
    recentlyChanged,
    newFromSpreadsheet,
  };
}
