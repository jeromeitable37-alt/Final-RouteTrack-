"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardCopy, Download, Save, Send } from "lucide-react";
import { DocumentRecord, HandoverRecord, SessionUser } from "@/lib/types";
import { addHandover, subscribeHandovers } from "@/lib/operations-service";
import { formatDateTime } from "@/lib/utils";

function normalize(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

export function ShiftHandoverPage({
  user,
  documents,
  notify,
}: {
  user: SessionUser;
  documents: DocumentRecord[];
  notify: (message: string, error?: boolean) => void;
}) {
  const [saved, setSaved] = useState<HandoverRecord[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => subscribeHandovers(user, setSaved), [user]);

  const important = useMemo(() => documents.filter((item) => {
    const status = normalize(item.status);
    return !item.archivedAt && (status === "missing" || status.includes("returned") || (item.lastRoutedAt && !item.lastReceivedBy));
  }), [documents]);

  const generated = useMemo(() => {
    const active = documents.filter((item) => {
      const status = normalize(item.status);
      return !item.archivedAt && status !== "completed" && status !== "cancelled";
    });
    const today = new Date().toISOString().slice(0, 10);
    const handledToday = documents.filter((item) => String(item.updatedAt || "").slice(0, 10) === today);
    const completedToday = documents.filter((item) => normalize(item.status) === "completed" && String(item.completedAt || item.updatedAt || "").slice(0, 10) === today);
    const lines = [
      `ROUTETRACK SHIFT HANDOVER — ${today}`,
      `Prepared by: ${user.displayName}`,
      "",
      `Documents handled today: ${handledToday.length}`,
      `Active documents: ${active.length}`,
      `Completed today: ${completedToday.length}`,
      `Important follow-ups: ${important.length}`,
      "",
      "DOCUMENTS NEEDING ATTENTION:",
      ...(important.length ? important.slice(0, 20).map((item) => `- ${item.type} ${item.requestNo} — ${item.status}; current holder: ${item.currentHolder}`) : ["- None"]),
      "",
      "NOTES FOR THE NEXT STUDENT ASSISTANT:",
      notes.trim() || "- Add handover notes here.",
    ];
    return lines.join("\n");
  }, [documents, important, notes, user.displayName]);

  async function save() {
    setSaving(true);
    try {
      await addHandover(user, generated, important.map((item) => item.id));
      notify("Shift handover saved.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to save the handover.", true);
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(generated);
    notify("Handover copied to the clipboard.");
  }

  function download() {
    const blob = new Blob([generated], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `routetrack-handover-${new Date().toISOString().slice(0, 10)}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page-section handover-page">
      <section className="panel handover-editor">
        <div className="panel-heading"><div><p className="eyebrow">SHIFT CONTINUITY</p><h2>Student Assistant handover</h2></div><Send size={20} /></div>
        <p className="muted">The report automatically includes active and important documents. Add only the notes the next assistant needs.</p>
        <label>Notes for the next shift<textarea rows={5} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Example: Follow up PRF 2026-011 with Audit before noon." /></label>
        <pre className="handover-preview">{generated}</pre>
        <div className="handover-actions">
          <button className="secondary-button" onClick={() => void copy()}><ClipboardCopy size={17} /> Copy</button>
          <button className="secondary-button" onClick={download}><Download size={17} /> Download</button>
          <button className="primary-button" onClick={() => void save()} disabled={saving}><Save size={17} /> {saving ? "Saving…" : "Save handover"}</button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading"><h2>Previous handovers</h2><span>{saved.length}</span></div>
        <div className="handover-history">
          {saved.slice(0, 20).map((item) => <details key={item.id}><summary><strong>{item.ownerName}</strong><span>{formatDateTime(item.createdAt)}</span></summary><pre>{item.summary}</pre></details>)}
          {!saved.length && <div className="empty-panel">No handover report saved yet.</div>}
        </div>
      </section>
    </div>
  );
}
