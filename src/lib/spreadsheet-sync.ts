import * as XLSX from "xlsx";
import { adminDb } from "@/lib/firebase-admin";
import { DOCUMENT_STATUSES, DOCUMENT_TYPES, DocumentStatus, DocumentType } from "@/lib/types";
import { trackingId } from "@/lib/utils";

export const ROUTETRACK_SPREADSHEET_ID = "1h4OvmGWLzhUf2A9xk8uOmeVQgrKV1Xug42n9LH77Avw";

function key(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function readValue(row: Record<string, unknown>, aliases: string[]): unknown {
  for (const alias of aliases) {
    const match = Object.entries(row).find(([header]) => key(header) === key(alias));
    if (match) return match[1];
  }
  return "";
}

function normalizeDate(value: unknown): string {
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const text = String(value ?? "").trim();
  if (!text) return new Date().toISOString().slice(0, 10);
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
}

function normalizeType(value: unknown): DocumentType {
  const text = String(value || "PRF").trim().toUpperCase();
  return DOCUMENT_TYPES.includes(text as DocumentType) ? text as DocumentType : "PRF";
}

function normalizeStatus(value: unknown): DocumentStatus {
  const text = String(value || "For Routing").trim().toLowerCase();
  return DOCUMENT_STATUSES.find((item) => item.toLowerCase() === text) || "For Routing";
}

function documentKey(type: unknown, requestNo: unknown): string {
  return `${String(type || "").trim().toLowerCase()}::${String(requestNo || "").trim().toLowerCase()}`;
}

function numberValue(value: unknown): number {
  return Number(String(value ?? "").replace(/[^0-9.-]/g, "")) || 0;
}

function sheetUrl(): string {
  const spreadsheetId = process.env.ROUTETRACK_SPREADSHEET_ID || ROUTETRACK_SPREADSHEET_ID;
  const gid = process.env.ROUTETRACK_SPREADSHEET_GID || "0";
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&gid=${encodeURIComponent(gid)}`;
}

export async function syncSpreadsheet(actor: { uid: string; displayName: string; email: string }) {
  const response = await fetch(sheetUrl(), { cache: "no-store" });
  if (!response.ok) throw new Error(`Google Sheet returned HTTP ${response.status}. Make sure the sheet can be viewed by the sync service.`);

  const csv = await response.text();
  const workbook = XLSX.read(csv, { type: "string", raw: false });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new Error("The Google Sheet has no readable worksheet.");

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" });
  const validRows = rows
    .map((row, index) => ({ row, rowNumber: index + 2 }))
    .map(({ row, rowNumber }) => {
      const requestNo = String(readValue(row, ["request no", "document number", "number", "request number", "prf no", "srf no", "crf no", "po no"])).trim();
      if (!requestNo) return null;
      const type = normalizeType(readValue(row, ["type", "document type"]));
      return {
        rowNumber,
        type,
        requestNo,
        dateRequested: normalizeDate(readValue(row, ["date requested", "document date", "date", "date logged"])),
        requestingDepartment: String(readValue(row, ["requesting department", "department", "requesting office"])).trim(),
        organization: String(readValue(row, ["organization", "company", "school"])).trim(),
        requestor: String(readValue(row, ["requestor", "requisitioner", "purchasing employee", "employee"])).trim(),
        supplier: String(readValue(row, ["supplier", "vendor"])).trim(),
        amount: numberValue(readValue(row, ["amount", "total amount", "total"])),
        currentHolder: String(readValue(row, ["current holder", "current office", "approver", "routed to", "office", "location"])).trim() || "Student Assistant / Records",
        status: normalizeStatus(readValue(row, ["status", "document status"])),
        description: String(readValue(row, ["description", "purpose", "items", "items description", "subject"])).trim(),
        remarks: String(readValue(row, ["remarks", "remark", "notes", "comments"])).trim(),
        physicalLocation: String(readValue(row, ["physical location", "location"])).trim(),
        dueDate: String(readValue(row, ["due date", "deadline"])).trim(),
      };
    })
    .filter(Boolean) as Array<{
      rowNumber: number; type: DocumentType; requestNo: string; dateRequested: string; requestingDepartment: string;
      organization: string; requestor: string; supplier: string; amount: number; currentHolder: string;
      status: DocumentStatus; description: string; remarks: string; physicalLocation: string; dueDate: string;
    }>;

  const db = adminDb();
  const snapshot = await db.collection("documents").get();
  const existing = new Map<string, { id: string; data: Record<string, unknown> }>();
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const k = documentKey(data.type, data.requestNo);
    if (k !== "::") existing.set(k, { id: doc.id, data });
  });

  const batch = db.batch();
  const now = new Date().toISOString();
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of validRows) {
    const match = existing.get(documentKey(row.type, row.requestNo));
    if (match) {
      const changes = {
        dateRequested: row.dateRequested,
        dateLogged: String(match.data.dateLogged || row.dateRequested),
        requestingDepartment: row.requestingDepartment || String(match.data.requestingDepartment || ""),
        organization: row.organization || String(match.data.organization || ""),
        requestor: row.requestor || String(match.data.requestor || ""),
        purchasingEmployee: row.requestor || String(match.data.purchasingEmployee || match.data.requestor || ""),
        supplier: row.supplier || String(match.data.supplier || ""),
        amount: row.amount || Number(match.data.amount || 0),
        currentHolder: row.currentHolder,
        status: row.status,
        subjectPurpose: row.description || String(match.data.subjectPurpose || ""),
        itemsDescription: row.description || String(match.data.itemsDescription || ""),
        remarks: row.remarks || String(match.data.remarks || ""),
        physicalLocation: row.physicalLocation || String(match.data.physicalLocation || ""),
        dueDate: row.dueDate || String(match.data.dueDate || ""),
        updatedAt: now,
        spreadsheetSyncAt: now,
        spreadsheetRow: row.rowNumber,
      };
      batch.update(db.collection("documents").doc(match.id), changes);
      updated += 1;
      continue;
    }

    const ref = db.collection("documents").doc();
    batch.set(ref, {
      trackingId: trackingId(row.type),
      ownerUid: actor.uid,
      ownerName: actor.displayName,
      ownerEmail: actor.email,
      type: row.type,
      requestNo: row.requestNo,
      dateRequested: row.dateRequested,
      requestingDepartment: row.requestingDepartment,
      requestor: row.requestor,
      subjectPurpose: row.description,
      amount: row.amount,
      dateLogged: row.dateRequested,
      currentHolder: row.currentHolder,
      status: row.status,
      dueDate: row.dueDate,
      copyType: "Original",
      physicalLocation: row.physicalLocation,
      remarks: row.remarks || "Imported automatically from Google Sheets.",
      routeCount: 0,
      organization: row.organization,
      supplier: row.supplier,
      purchasingEmployee: row.requestor,
      dateForwardedSupplier: "",
      paymentTerms: "",
      itemsDescription: row.description,
      lastToOffice: row.currentHolder,
      lastRoutePurpose: "Google Sheets automatic synchronization",
      lastMovementStatus: "Routed",
      lastRouteEncodedBy: actor.displayName,
      createdAt: now,
      updatedAt: now,
      spreadsheetSyncAt: now,
      spreadsheetRow: row.rowNumber,
    });
    created += 1;
  }

  await batch.commit();
  skipped = rows.length - validRows.length;
  return { created, updated, skipped, totalRows: rows.length, source: sheetUrl() };
}
