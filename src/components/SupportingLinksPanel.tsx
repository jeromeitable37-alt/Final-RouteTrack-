"use client";

import { FormEvent, useEffect, useState } from "react";
import { ExternalLink, Link2, Plus } from "lucide-react";
import { DocumentRecord, SessionUser, SupportingLinkRecord } from "@/lib/types";
import { addSupportingLink, subscribeSupportingLinks } from "@/lib/operations-service";
import { formatDateTime } from "@/lib/utils";

export function SupportingLinksPanel({
  user,
  document,
  notify,
}: {
  user: SessionUser;
  document: DocumentRecord;
  notify: (message: string, error?: boolean) => void;
}) {
  const [items, setItems] = useState<SupportingLinkRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(
    () => subscribeSupportingLinks(document.id, setItems),
    [document.id],
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    let normalizedUrl = url.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) normalizedUrl = `https://${normalizedUrl}`;
    try {
      new URL(normalizedUrl);
    } catch {
      notify("Enter a valid supporting-file link.", true);
      return;
    }

    setSaving(true);
    try {
      await addSupportingLink(user, document, {
        title: title.trim(),
        url: normalizedUrl,
        notes: notes.trim(),
      });
      setTitle("");
      setUrl("");
      setNotes("");
      setOpen(false);
      notify("Supporting link added.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to add the supporting link.", true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="operations-subpanel no-print">
      <div className="section-heading compact-heading">
        <div>
          <p className="eyebrow">SUPPORTING FILES</p>
          <h3>Google Drive, OneDrive, or approved cloud links</h3>
        </div>
        <button className="secondary-button compact-button" onClick={() => setOpen((value) => !value)}>
          <Plus size={15} /> Add link
        </button>
      </div>

      {open && (
        <form className="support-link-form" onSubmit={submit}>
          <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
          <label>Secure link<input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." required /></label>
          <label className="support-link-wide">Notes<textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          <div className="followup-actions support-link-wide">
            <button type="button" className="text-button" onClick={() => setOpen(false)}>Cancel</button>
            <button className="primary-button" disabled={saving}><Link2 size={16} /> {saving ? "Saving…" : "Save link"}</button>
          </div>
        </form>
      )}

      {items.length ? (
        <div className="support-link-list">
          {items.map((item) => (
            <a key={item.id} href={item.url} target="_blank" rel="noreferrer">
              <div><Link2 size={17} /></div>
              <span><strong>{item.title}</strong><small>{item.notes || `${item.createdByName} · ${formatDateTime(item.createdAt)}`}</small></span>
              <ExternalLink size={16} />
            </a>
          ))}
        </div>
      ) : <div className="empty-panel compact-empty">No supporting link added.</div>}
    </section>
  );
}
