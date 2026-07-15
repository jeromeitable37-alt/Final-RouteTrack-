"use client";

import { FormEvent, useMemo, useState } from "react";
import { DocumentRecord, MOVEMENT_STATUSES, RoutingInput } from "@/lib/types";
import { nowLocalInput } from "@/lib/utils";
import { ROUTE_CONTACTS, ROUTE_PURPOSES, nextRouteSuggestions, suggestedPurpose } from "@/lib/workflow";
import { SmartInput } from "./SmartInput";

export function RoutingForm({ document, onSubmit, onCancel }: { document: DocumentRecord; onSubmit: (input: RoutingInput) => Promise<void>; onCancel: () => void }) {
  const suggestions = useMemo(() => nextRouteSuggestions(document), [document]);
  const initialDestination = suggestions[0] || "";
  const [form, setForm] = useState<RoutingInput>({
    dateTimeRouted: nowLocalInput(),
    fromOffice: document.currentHolder || "Student Assistant / Records",
    toOffice: initialDestination,
    actionPurpose: suggestedPurpose(initialDestination),
    receivedBy: "",
    dateTimeReceived: "",
    movementStatus: "Routed",
    proofReference: "",
    remarks: "",
  });
  const [saving, setSaving] = useState(false);

  function update<K extends keyof RoutingInput>(key: K, value: RoutingInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function chooseDestination(value: string) {
    setForm((current) => ({ ...current, toOffice: value, actionPurpose: suggestedPurpose(value) }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try { await onSubmit(form); } finally { setSaving(false); }
  }

  return (
    <form className="document-form" onSubmit={submit}>
      {suggestions.length > 0 && <section className="route-suggestions">
        <span>Suggested next route</span>
        <div>{suggestions.map((item) => <button type="button" key={item} className={form.toOffice === item ? "suggestion-chip active" : "suggestion-chip"} onClick={() => chooseDestination(item)}>{item}</button>)}</div>
      </section>}

      <div className="form-grid">
        <label>Date / time routed<input type="datetime-local" value={form.dateTimeRouted} onChange={(event) => update("dateTimeRouted", event.target.value)} required /></label>
        <label>Movement status<select value={form.movementStatus} onChange={(event) => update("movementStatus", event.target.value as RoutingInput["movementStatus"])}>{MOVEMENT_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></label>
        <SmartInput label="From person / office" value={form.fromOffice} options={ROUTE_CONTACTS} onChange={(fromOffice) => update("fromOffice", fromOffice)} required />
        <SmartInput label="Route to person / office" value={form.toOffice} options={ROUTE_CONTACTS} onChange={chooseDestination} required help="Choose a suggestion or type another person or department." />
        <SmartInput className="span-2" label="Purpose / action needed" value={form.actionPurpose} options={ROUTE_PURPOSES} onChange={(actionPurpose) => update("actionPurpose", actionPurpose)} required />
        <label>Received by<input value={form.receivedBy} onChange={(event) => update("receivedBy", event.target.value)} placeholder="Optional acknowledgment name" /></label>
        <label>Date / time received<input type="datetime-local" value={form.dateTimeReceived} onChange={(event) => update("dateTimeReceived", event.target.value)} /></label>
        <label>Proof / reference<input value={form.proofReference} onChange={(event) => update("proofReference", event.target.value)} placeholder="Signature, message, email reference" /></label>
        <label>Remarks<input value={form.remarks} onChange={(event) => update("remarks", event.target.value)} /></label>
      </div>
      <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? "Saving…" : "Record handoff"}</button></div>
    </form>
  );
}
