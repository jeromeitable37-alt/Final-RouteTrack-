import * as XLSX from "xlsx";
import type { WriteBatch } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { DOCUMENT_STATUSES, DOCUMENT_TYPES, DocumentStatus, DocumentType } from "@/lib/types";
import { trackingId } from "@/lib/utils";
import { analyzeDocument } from "@/lib/automation";

export const ROUTETRACK_SPREADSHEET_ID = "1h4OvmGWLzhUf2A9xk8uOmeVQgrKV1Xug42n9LH77Avw";
const WRITE_CHUNK_SIZE = 400;

type SyncActor = { uid: string; displayName: string; email: string };

type SheetRow = {
  rowNumber: number;
  type: DocumentType;
  requestNo: string;
  dateRequested: string;
  requestingDepartment: string;
  organization: string;
  requestor: string;
  supplier: string;
  amount: number;
  currentHolder: string;
  status: DocumentStatus;
  description: string;
  remarks: string;
  physicalLocation: string;
  dueDate: string;
  fromOffice: string;
  toOffice: string;
  routeDate: string;
  receivedBy: string;
  receivedAt: string;
  movementStatus: "Routed" | "Received" | "Returned" | "On Hold";
  routePurpose: string;
  fingerprint: string;
};

function headerKey(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizeDocumentNumber(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function readValue(row: Record<string, unknown>, aliases: string[]): unknown {
  for (const alias of aliases) {
    const wanted = headerKey(alias);
    const match = Object.entries(row).find(([header]) => headerKey(header) === wanted);
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
  if (!text) return "";
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : date.toISOString().slice(0, 10);
}

function normalizeDateTime(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : date.toISOString();
}

function normalizeType(value: unknown): DocumentType {
  const text = String(value || "PRF").trim().toUpperCase();
  return DOCUMENT_TYPES.includes(text as DocumentType) ? text as DocumentType : "PRF";
}

function normalizeStatus(value: unknown): DocumentStatus {
  const text = String(value || "For Routing").trim().toLowerCase();
  const exact = DOCUMENT_STATUSES.find((item) => item.toLowerCase() === text);
  if (exact) return exact;
  if (text.includes("route")) return "For Routing";
  if (text.includes("transit")) return "In Transit";
  if (text.includes("received")) return "Received";
  if (text.includes("review")) return "Under Review";
  if (text.includes("approval")) return "For Approval";
  if (text.includes("correction") || text.includes("returned")) return "Returned for Correction";
  if (text.includes("complete")) return "Completed";
  if (text.includes("cancel")) return "Cancelled";
  if (text.includes("missing")) return "Missing";
  return "For Routing";
}

function normalizeMovementStatus(value: unknown, status: DocumentStatus): SheetRow["movementStatus"] {
  const text = String(value || "").trim().toLowerCase();
  if (text.includes("received")) return "Received";
  if (text.includes("return")) return "Returned";
  if (text.includes("hold")) return "On Hold";
  if (text.includes("route") || text.includes("transit")) return "Routed";
  if (status === "Received") return "Received";
  if (status === "Returned for Correction") return "Returned";
  return "Routed";
}

function numberValue(value: unknown): number {
  return Number(String(value ?? "").replace(/[^0-9.-]/g, "")) || 0;
}

function sheetUrl(): string {
  const spreadsheetId = process.env.ROUTETRACK_SPREADSHEET_ID || ROUTETRACK_SPREADSHEET_ID;
  const gid = process.env.ROUTETRACK_SPREADSHEET_GID || "0";
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&gid=${encodeURIComponent(gid)}`;
}

function documentKey(type: unknown, requestNo: unknown): string {
  return `${String(type || "").trim().toLowerCase()}::${normalizeDocumentNumber(requestNo)}`;
}

function rowFingerprint(row: Omit<SheetRow, "fingerprint" | "rowNumber">): string {
  const important = [
    row.type, row.requestNo, row.dateRequested, row.requestingDepartment, row.organization,
    row.requestor, row.supplier, row.amount, row.currentHolder, row.status, row.description,
    row.remarks, row.physicalLocation, row.dueDate, row.fromOffice, row.toOffice, row.routeDate,
    row.receivedBy, row.receivedAt, row.movementStatus, row.routePurpose,
  ];
  return JSON.stringify(important).toLowerCase();
}

function toDateTime(value: string, fallback: string): string {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

async function commitOps(db: ReturnType<typeof adminDb>, ops: Array<(batch: WriteBatch) => void>) {
  for (let offset = 0; offset < ops.length; offset += WRITE_CHUNK_SIZE) {
    const batch = db.batch();
    for (const operation of ops.slice(offset, offset + WRITE_CHUNK_SIZE)) operation(batch);
    await batch.commit();
  }
}

export async function syncSpreadsheet(actor: SyncActor) {
  const response = await fetch(sheetUrl(), { cache: "no-store" });
  if (!response.ok) throw new Error(`Google Sheet returned HTTP ${response.status}. Make sure the sheet can be viewed by the sync service.`);

  const csv = await response.text();
  const workbook = XLSX.read(csv, { type: "string", raw: false });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new Error("The Google Sheet has no readable worksheet.");

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" });
  const validRows: SheetRow[] = rawRows.map((row, index) => {
    const requestNo = String(readValue(row, ["request no", "document number", "number", "request number", "prf no", "srf no", "crf no", "po no"])).trim();
    if (!requestNo) return null;
    const type = normalizeType(readValue(row, ["type", "document type"]));
    const dateRequested = normalizeDate(readValue(row, ["date requested", "document date", "date", "date logged"]));
    const currentHolder = String(readValue(row, ["current holder", "current office", "approver", "routed to", "office", "location"]) || "").trim();
    const toOffice = String(readValue(row, ["to office", "route to", "routed to", "next office", "destination", "current holder", "current office"]) || currentHolder).trim();
    const fromOffice = String(readValue(row, ["from office", "routed from", "previous office", "source office", "from"]) || "").trim();
    const status = normalizeStatus(readValue(row, ["status", "document status", "routing status"]));
    const routeDate = normalizeDateTime(readValue(row, ["date/time routed", "datetime routed", "date routed", "route date", "routing date"]));
    const receivedAt = normalizeDateTime(readValue(row, ["date/time received", "datetime received", "date received", "received date"]));
    const receivedBy = String(readValue(row, ["received by", "receiver", "acknowledged by"]) || "").trim();
    const routePurpose = String(readValue(row, ["route purpose", "routing purpose", "action needed", "purpose", "action"]) || "").trim();
    const movementStatus = normalizeMovementStatus(readValue(row, ["movement status", "route status", "movement"]), status);
    const base = {
      type,
      requestNo,
      dateRequested,
      requestingDepartment: String(readValue(row, ["requesting department", "department", "requesting office"]) || "").trim(),
      organization: String(readValue(row, ["organization", "company", "school"]) || "").trim(),
      requestor: String(readValue(row, ["requestor", "requisitioner", "purchasing employee", "employee"]) || "").trim(),
      supplier: String(readValue(row, ["supplier", "vendor"]) || "").trim(),
      amount: numberValue(readValue(row, ["amount", "total amount", "total"])),
      currentHolder: currentHolder || toOffice || "Student Assistant / Records",
      status,
      description: String(readValue(row, ["description", "purpose", "items", "items description", "subject"]) || "").trim(),
      remarks: String(readValue(row, ["remarks", "remark", "notes", "comments"]) || "").trim(),
      physicalLocation: String(readValue(row, ["physical location", "location"]) || "").trim(),
      dueDate: String(readValue(row, ["due date", "deadline"]) || "").trim(),
      fromOffice,
      toOffice: toOffice || currentHolder || "Student Assistant / Records",
      routeDate,
      receivedBy,
      receivedAt,
      movementStatus,
      routePurpose,
    };
    return { rowNumber: index + 2, ...base, fingerprint: rowFingerprint(base) } satisfies SheetRow;
  }).filter(Boolean) as SheetRow[];

  // If the same document appears more than once in the spreadsheet, process the most recent row once.
  const rowByKey = new Map<string, SheetRow>();
  for (const row of validRows) rowByKey.set(documentKey(row.type, row.requestNo), row);
  const rows = [...rowByKey.values()];

  const db = adminDb();
  const snapshot = await db.collection("documents").get();
  const existingByKey = new Map<string, { id: string; data: Record<string, any> }[]>();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const k = documentKey(data.type, data.requestNo);
    if (!existingByKey.has(k)) existingByKey.set(k, []);
    existingByKey.get(k)!.push({ id: doc.id, data });
  }

  const now = new Date().toISOString();
  const writes: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];
  let created = 0;
  let updated = 0;
  let skipped = rawRows.length - validRows.length;
  let unchanged = 0;
  let changed = 0;
  let routeChanges = 0;
  let statusChanges = 0;
  let duplicateMatches = 0;

  for (const row of rows) {
    const matches = existingByKey.get(documentKey(row.type, row.requestNo)) || [];
    const canonical = matches.find((item) => item.data.isDuplicate !== true) || matches[0];

    if (matches.length > 1) {
      duplicateMatches += matches.length - 1;
      for (const duplicate of matches) {
        if (duplicate.id === canonical?.id) continue;
        writes.push((batch) => batch.update(db.collection("documents").doc(duplicate.id), {
          isDuplicate: true,
          duplicateOf: canonical?.id || "",
          duplicateDetectedAt: now,
          updatedAt: now,
        }));
      }
    }

    if (!canonical) {
      const ref = db.collection("documents").doc();
      const initial = {
        trackingId: trackingId(row.type),
        ownerUid: actor.uid,
        ownerName: actor.displayName,
        ownerEmail: actor.email,
        type: row.type,
        requestNo: row.requestNo,
        dateRequested: row.dateRequested || now.slice(0, 10),
        requestingDepartment: row.requestingDepartment,
        requestor: row.requestor,
        subjectPurpose: row.description,
        amount: row.amount,
        dateLogged: row.dateRequested || now.slice(0, 10),
        currentHolder: row.currentHolder,
        status: row.status,
        dueDate: row.dueDate,
        copyType: "Original",
        physicalLocation: row.physicalLocation,
        remarks: row.remarks || "Imported automatically from the monitoring spreadsheet.",
        routeCount: row.routeDate || row.fromOffice || row.receivedBy || row.receivedAt ? 1 : 0,
        organization: row.organization,
        supplier: row.supplier,
        purchasingEmployee: row.requestor,
        dateForwardedSupplier: "",
        paymentTerms: "",
        itemsDescription: row.description,
        lastRoutedAt: row.routeDate ? toDateTime(row.routeDate, now) : "",
        lastFromOffice: row.fromOffice,
        lastToOffice: row.toOffice || row.currentHolder,
        lastRoutePurpose: row.routePurpose || "Google Sheets automatic synchronization",
        lastReceivedBy: row.receivedBy,
        lastReceivedAt: row.receivedAt ? toDateTime(row.receivedAt, now) : "",
        lastMovementStatus: row.movementStatus,
        lastRouteEncodedBy: actor.displayName,
        createdAt: now,
        updatedAt: now,
        spreadsheetSyncAt: now,
        spreadsheetRow: row.rowNumber,
        spreadsheetFingerprint: row.fingerprint,
        spreadsheetLastStatus: row.status,
        spreadsheetLastHolder: row.currentHolder,
        spreadsheetLastRouteAt: row.routeDate,
        syncSource: "google-sheet",
      };
      const provisional = { id: ref.id, ...initial } as any;
      const analysis = analyzeDocument(provisional, Date.now());
      writes.push((batch) => batch.set(ref, {
        ...initial,
        automationPriority: analysis.priority,
        automationRecommendation: analysis.recommendation,
        automationReasons: analysis.reasons,
        automationUpdatedAt: now,
        ...(row.routeDate ? { spreadsheetChangedAt: now } : {}),
      }));
      created += 1;
      if (row.routeDate || row.fromOffice || row.receivedBy || row.receivedAt) routeChanges += 1;
      continue;
    }

    const previous = canonical.data;
    const previousHolder = String(previous.currentHolder || previous.lastToOffice || "").trim();
    const previousStatus = normalizeStatus(previous.status);
    const nextHolder = row.currentHolder || row.toOffice || previousHolder || "Student Assistant / Records";
    const holderChanged = normalizeDocumentNumber(previousHolder) !== normalizeDocumentNumber(nextHolder);
    const statusChanged = String(previousStatus).toLowerCase() !== String(row.status).toLowerCase();
    if (statusChanged) statusChanges += 1;
    const fingerprintChanged = String(previous.spreadsheetFingerprint || "") !== row.fingerprint;
    const routeWasSupplied = Boolean(
      readValue(row as unknown as Record<string, unknown>, ["to office", "route to", "next office", "destination", "current holder", "current office"]) ||
      readValue(row as unknown as Record<string, unknown>, ["from office", "routed from", "previous office", "source office", "from"]) ||
      readValue(row as unknown as Record<string, unknown>, ["date/time routed", "datetime routed", "date routed", "route date", "routing date"]) ||
      readValue(row as unknown as Record<string, unknown>, ["received by", "receiver", "acknowledged by"]) ||
      readValue(row as unknown as Record<string, unknown>, ["date/time received", "datetime received", "date received", "received date"])
    );
    const nowDateTime = now;
    const lastRoute = row.routeDate ? toDateTime(row.routeDate, nowDateTime) : String(previous.lastRoutedAt || "");
    const changes = {
      dateRequested: row.dateRequested || previous.dateRequested || now.slice(0, 10),
      dateLogged: previous.dateLogged || row.dateRequested || now.slice(0, 10),
      requestingDepartment: row.requestingDepartment || previous.requestingDepartment || "",
      organization: row.organization || previous.organization || "",
      requestor: row.requestor || previous.requestor || "",
      purchasingEmployee: row.requestor || previous.purchasingEmployee || previous.requestor || "",
      supplier: row.supplier || previous.supplier || "",
      amount: row.amount || Number(previous.amount || 0),
      currentHolder: nextHolder,
      status: row.status,
      subjectPurpose: row.description || previous.subjectPurpose || "",
      itemsDescription: row.description || previous.itemsDescription || "",
      remarks: row.remarks || previous.remarks || "",
      physicalLocation: row.physicalLocation || previous.physicalLocation || "",
      dueDate: row.dueDate || previous.dueDate || "",
      spreadsheetSyncAt: now,
      spreadsheetRow: row.rowNumber,
      spreadsheetFingerprint: row.fingerprint,
      spreadsheetLastStatus: row.status,
      spreadsheetLastHolder: nextHolder,
      spreadsheetLastRouteAt: row.routeDate || String(previous.spreadsheetLastRouteAt || ""),
      syncSource: "google-sheet",
      updatedAt: now,
      ...(fingerprintChanged ? { spreadsheetChangedAt: now } : {}),
      ...(routeWasSupplied ? {
        lastRoutedAt: lastRoute,
        lastFromOffice: row.fromOffice || previous.lastFromOffice || previousHolder,
        lastToOffice: row.toOffice || nextHolder,
        lastRoutePurpose: row.routePurpose || previous.lastRoutePurpose || "Google Sheets automatic synchronization",
        lastReceivedBy: row.receivedBy || previous.lastReceivedBy || "",
        lastReceivedAt: row.receivedAt ? toDateTime(row.receivedAt, nowDateTime) : String(previous.lastReceivedAt || ""),
        lastMovementStatus: row.movementStatus,
        lastRouteEncodedBy: actor.displayName,
      } : {}),
    };
    const simulated = { ...previous, id: canonical.id, ...changes } as any;
    const analysis = analyzeDocument(simulated, Date.now());
    const automationChanged =
      String(previous.automationPriority || "") !== analysis.priority ||
      String(previous.automationRecommendation || "") !== analysis.recommendation ||
      JSON.stringify(previous.automationReasons || []) !== JSON.stringify(analysis.reasons);

    writes.push((batch) => batch.update(db.collection("documents").doc(canonical.id), {
      ...changes,
      routeCount: Number(previous.routeCount || 0) + (holderChanged || (routeWasSupplied && !previous.lastRoutedAt) ? 1 : 0),
      automationPriority: analysis.priority,
      automationRecommendation: analysis.recommendation,
      automationReasons: analysis.reasons,
      automationUpdatedAt: now,
    }));

    if (fingerprintChanged || automationChanged) updated += 1;
    else unchanged += 1;
    if (fingerprintChanged) changed += 1;

    if (holderChanged || (routeWasSupplied && row.routeDate && String(previous.spreadsheetLastRouteAt || "") !== row.routeDate)) {
      routeChanges += 1;
      const routeRef = db.collection("documents").doc(canonical.id).collection("routes").doc();
      writes.push((batch) => batch.set(routeRef, {
        documentId: canonical.id,
        dateTimeRouted: lastRoute || now,
        fromOffice: row.fromOffice || previousHolder || "Spreadsheet",
        toOffice: row.toOffice || nextHolder,
        actionPurpose: row.routePurpose || "Routing update detected from Google Sheets",
        receivedBy: row.receivedBy || "",
        dateTimeReceived: row.receivedAt ? toDateTime(row.receivedAt, now) : "",
        movementStatus: row.movementStatus,
        proofReference: "",
        receiverConfirmation: "",
        eventType: holderChanged ? "route" : "status",
        remarks: holderChanged
          ? `Automatically detected from the monitoring spreadsheet. Previous holder: ${previousHolder || "not recorded"}.`
          : `Automatically detected spreadsheet status update: ${previousStatus} → ${row.status}.`,
        createdAt: now,
        createdByUid: actor.uid,
        createdByName: actor.displayName,
        source: "google-sheet",
      }));
    } else if (statusChanged) {
      const routeRef = db.collection("documents").doc(canonical.id).collection("routes").doc();
      writes.push((batch) => batch.set(routeRef, {
        documentId: canonical.id,
        dateTimeRouted: now,
        fromOffice: previousHolder || "Spreadsheet",
        toOffice: nextHolder,
        actionPurpose: `Status changed from ${previousStatus || "unknown"} to ${row.status}`,
        receivedBy: row.receivedBy || "",
        dateTimeReceived: row.receivedAt ? toDateTime(row.receivedAt, now) : "",
        movementStatus: row.movementStatus,
        proofReference: "",
        receiverConfirmation: "",
        eventType: "status",
        remarks: "Automatically detected from the monitoring spreadsheet.",
        createdAt: now,
        createdByUid: actor.uid,
        createdByName: actor.displayName,
        source: "google-sheet",
      }));
    }
  }

  await commitOps(db, writes);

  const syncId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await db.collection("syncRuns").doc(syncId).set({
    source: "google-sheet",
    sourceUrl: sheetUrl(),
    startedAt: now,
    completedAt: new Date().toISOString(),
    actorUid: actor.uid,
    actorName: actor.displayName,
    actorEmail: actor.email,
    rawRows: rawRows.length,
    validRows: validRows.length,
    uniqueDocuments: rows.length,
    created,
    updated,
    unchanged,
    changed,
    skipped,
    routeChanges,
    statusChanges,
    duplicateMatches,
    ok: true,
  });

  return {
    created,
    updated,
    changed,
    skipped,
    routeChanges,
    statusChanges,
    duplicateMatches,
    unchanged,
    totalRows: rawRows.length,
    uniqueDocuments: rows.length,
    source: sheetUrl(),
    syncRunId: syncId,
    syncedAt: new Date().toISOString(),
  };
}
