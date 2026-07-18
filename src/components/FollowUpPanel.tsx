"use client";

import { FormEvent, useEffect, useState } from "react";
import { CalendarClock, Check, ClipboardCheck, Plus } from "lucide-react";
import {
  FOLLOW_UP_METHODS,
  DocumentRecord,
  FollowUpMethod,
  FollowUpRecord,
  SessionUser,
} from "@/lib/types";
import { addFollowUp, subscribeFollowUps } from "@/lib/operations-service";
import { formatDateTime } from "@/lib/utils";

export function FollowUpPanel({
  user,
  document,
  notify,
}: {
  user: SessionUser;
  document: DocumentRecord;
  notify: (message: string, error?: boolean) => void;
}) {
  const [items, setItems] = useState<FollowUpRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [contactedPerson, setContactedPerson] = useState(document.currentHolder || "");
  const [method, setMethod] = useState<FollowUpMethod>("Personal");
  const [result, setResult] = useState("");
  const [nextFollowUpAt, setNextFollowUpAt] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(
    () => subscribeFollowUps(document.id, setItems),
    [document.id],
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!contactedPerson.trim() || !result.trim()) return;
    setSaving(true);
    try {
      await addFollowUp(user, document, {
        contactedPerson: contactedPerson.trim(),
        method,
        result: result.trim(),
        nextFollowUpAt,
        notes: notes.trim(),
      });
      setResult("");
      setNextFollowUpAt("");
      setNotes("");
      setOpen(false);
      notify("Follow-up recorded in the document history.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to save the follow-up.", true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="operations-subpanel no-print">
      <div className="section-heading compact-heading">
        <div>
          <p className="eyebrow">FOLLOW-UP HISTORY</p>
          <h3>Monitoring actions</h3>
        </div>
        <button className="secondary-button compact-button" onClick={() => setOpen((value) => !value)}>
          <Plus size={15} /> Record follow-up
        </button>
      </div>

      {document.nextFollowUpAt && (
        <div className="next-followup-banner">
          <CalendarClock size={17} />
          <span>Next follow-up: <strong>{formatDateTime(document.nextFollowUpAt)}</strong></span>
        </div>
      )}

      {open && (
        <form className="followup-form" onSubmit={submit}>
          <label>
            Person or office contacted
            <input value={contactedPerson} onChange={(event) => setContactedPerson(event.target.value)} required />
          </label>
          <label>
            Method
            <select value={method} onChange={(event) => setMethod(event.target.value as FollowUpMethod)}>
              {FOLLOW_UP_METHODS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="followup-wide">
            Result
            <input value={result} onChange={(event) => setResult(event.target.value)} placeholder="Example: Still under review" required />
          </label>
          <label>
            Next follow-up
            <input type="datetime-local" value={nextFollowUpAt} onChange={(event) => setNextFollowUpAt(event.target.value)} />
          </label>
          <label className="followup-wide">
            Notes
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} />
          </label>
          <div className="followup-actions followup-wide">
            <button type="button" className="text-button" onClick={() => setOpen(false)}>Cancel</button>
            <button className="primary-button" disabled={saving}><Check size={16} /> {saving ? "Saving…" : "Save follow-up"}</button>
          </div>
        </form>
      )}

      {items.length ? (
        <div className="followup-list">
          {items.map((item) => (
            <article key={item.id}>
              <div className="followup-icon"><ClipboardCheck size={16} /></div>
              <div>
                <strong>{item.contactedPerson} · {item.method}</strong>
                <p>{item.result}</p>
                <span>{item.createdByName} · {formatDateTime(item.createdAt)}</span>
                {item.notes && <small>{item.notes}</small>}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-panel compact-empty">No follow-up has been recorded.</div>
      )}
    </section>
  );
}
