"use client";

import { ChangeEvent, useState } from "react";
import { FileSpreadsheet, Upload, XCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { addActivityLog, addDocument } from "@/lib/data-service";
import {
  COPY_TYPES,
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
  DocumentInput,
  DocumentRecord,
  DocumentStatus,
  DocumentType,
  SessionUser,
} from "@/lib/types";

interface PreviewRow {
  rowNumber: number;
  type: DocumentType;
  requestNo: string;
  dateRequested: string;
  organization: string;
  requestor: string;
  supplier: string;
  amount: number;
  currentHolder: string;
  status: DocumentStatus;
  description: string;
  error?: string;
}

function key(value: unknown): string {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function readValue(row: Record<string, unknown>, aliases: string[]): unknown {
  const entries = Object.entries(row);
  for (const alias of aliases) {
    const found = entries.find(([header]) => key(header) === key(alias));
    if (found) return found[1];
  }
  return "";
}

function normalizeDate(value: unknown): string {
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const text = String(value || "").trim();
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

export function SpreadsheetImportPanel({
  user,
  existingDocuments,
  notify,
}: {
  user: SessionUser;
  existingDocuments: DocumentRecord[];
  notify: (message: string, error?: boolean) => void;
}) {
  const [filename, setFilename] = useState("");
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [importing, setImporting] = useState(false);

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const existing = new Set(existingDocuments.map((item) => item.requestNo.trim().toLowerCase()));
      const seen = new Set<string>();
      const preview = rawRows.slice(0, 500).map((row, index) => {
        const requestNo = String(readValue(row, ["request no", "document number", "number", "request number", "prf no", "srf no", "crf no", "po no"])).trim();
        const normalizedNo = requestNo.toLowerCase();
        let error = "";
        if (!requestNo) error = "Missing document number";
        else if (existing.has(normalizedNo)) error = "Already exists in RouteTrack";
        else if (seen.has(normalizedNo)) error = "Duplicate inside spreadsheet";
        seen.add(normalizedNo);
        return {
          rowNumber: index + 2,
          type: normalizeType(readValue(row, ["type", "document type"])),
          requestNo,
          dateRequested: normalizeDate(readValue(row, ["date requested", "document date", "date", "date logged"])),
          organization: String(readValue(row, ["organization", "company", "school"])).trim(),
          requestor: String(readValue(row, ["requestor", "requisitioner", "purchasing employee", "employee"])).trim(),
          supplier: String(readValue(row, ["supplier", "vendor"])).trim(),
          amount: Number(String(readValue(row, ["amount", "total amount"])).replace(/[^0-9.-]/g, "")) || 0,
          currentHolder: String(readValue(row, ["current holder", "approver", "routed to", "office"])).trim() || "Student Assistant / Records",
          status: normalizeStatus(readValue(row, ["status"])),
          description: String(readValue(row, ["description", "purpose", "items", "subject"])).trim(),
          error,
        };
      });
      setRows(preview);
      if (!preview.length) notify("The first spreadsheet sheet has no data rows.", true);
    } catch {
      setRows([]);
      notify("Unable to read the spreadsheet. Use an XLSX, XLS, or CSV file.", true);
    }
  }

  async function importRows() {
    const valid = rows.filter((row) => !row.error);
    if (!valid.length) {
      notify("There are no valid rows to import.", true);
      return;
    }
    if (!window.confirm(`Import ${valid.length} document record(s) into RouteTrack?`)) return;
    setImporting(true);
    let imported = 0;
    try {
      for (const row of valid) {
        const input: DocumentInput = {
          type: row.type,
          requestNo: row.requestNo,
          dateRequested: row.dateRequested,
          requestingDepartment: "",
          requestor: row.requestor,
          subjectPurpose: row.description,
          amount: row.amount,
          dateLogged: new Date().toISOString().slice(0, 10),
          currentHolder: row.currentHolder,
          status: row.status,
          dueDate: "",
          copyType: COPY_TYPES[0],
          physicalLocation: "",
          remarks: `Imported from ${filename}`,
          organization: row.organization,
          supplier: row.supplier,
          purchasingEmployee: row.requestor,
          dateForwardedSupplier: "",
          paymentTerms: "",
          itemsDescription: row.description,
          lastRoutedAt: "",
          lastFromOffice: "",
          lastToOffice: row.currentHolder,
          lastRoutePurpose: "Imported historical record",
          lastReceivedBy: "",
          lastReceivedAt: "",
          lastMovementStatus: "Routed",
          lastRouteEncodedBy: user.displayName || user.email,
          lastProofReference: "",
        };
        await addDocument(user, input);
        imported += 1;
      }
      await addActivityLog(user, "SPREADSHEET_IMPORT", `${imported} document record(s) imported from ${filename}.`);
      notify(`${imported} document record(s) imported successfully.`);
      setRows([]);
      setFilename("");
    } catch (error) {
      notify(`${imported} row(s) imported before an error occurred: ${error instanceof Error ? error.message : "Unknown error"}`, true);
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="panel spreadsheet-import-panel">
      <div className="panel-heading"><div><p className="eyebrow">SPREADSHEET MIGRATION</p><h2>Import old monitoring records</h2></div><FileSpreadsheet size={21} /></div>
      <p className="muted">Supported files: XLSX, XLS, and CSV. The importer recognizes common columns such as Type, Document Number, Date Requested, Supplier, Amount, Current Holder, and Status.</p>
      <label className="spreadsheet-dropzone">
        <Upload size={24} />
        <span><strong>{filename || "Choose a spreadsheet"}</strong><small>Maximum preview: 500 rows</small></span>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={(event) => void chooseFile(event)} />
      </label>
      {rows.length > 0 && (
        <>
          <div className="import-summary"><span>{rows.filter((row) => !row.error).length} ready</span><span>{rows.filter((row) => row.error).length} skipped</span><button className="primary-button" disabled={importing} onClick={() => void importRows()}>{importing ? "Importing…" : "Import valid rows"}</button></div>
          <div className="table-wrap import-preview"><table><thead><tr><th>Row</th><th>Document</th><th>Date</th><th>Holder</th><th>Status</th><th>Validation</th></tr></thead><tbody>{rows.slice(0, 100).map((row) => <tr key={row.rowNumber}><td>{row.rowNumber}</td><td><strong>{row.type} {row.requestNo || "—"}</strong><span>{row.supplier || row.requestor}</span></td><td>{row.dateRequested}</td><td>{row.currentHolder}</td><td>{row.status}</td><td>{row.error ? <span className="import-error"><XCircle size={14} /> {row.error}</span> : <span className="import-ready">Ready</span>}</td></tr>)}</tbody></table></div>
        </>
      )}
    </section>
  );
}
