"use client";

import { FormEvent, useState } from "react";
import { DocumentRecord, RoutingInput } from "@/lib/types";
import { nowLocalInput } from "@/lib/utils";
import { ROUTE_CONTACTS } from "@/lib/workflow";
import { SmartInput } from "./SmartInput";
import { ProofPhotoPicker } from "./ProofPhotoPicker";

export function AcknowledgmentForm({ document, onSubmit, onCancel }: {
  document: DocumentRecord;
  onSubmit: (input: RoutingInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [receivedBy, setReceivedBy] = useState("");
  const [dateTimeReceived, setDateTimeReceived] = useState(nowLocalInput());
  const [confirmation, setConfirmation] = useState("");
  const [proofReference, setProofReference] = useState("");
  const [proofPhotoDataUrl, setProofPhotoDataUrl] = useState("");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!receivedBy.trim() || !dateTimeReceived) return;
    setSaving(true);
    try {
      await onSubmit({
        dateTimeRouted: dateTimeReceived,
        fromOffice: document.currentHolder,
        toOffice: document.currentHolder,
        actionPurpose: "Receipt acknowledged",
        receivedBy: receivedBy.trim(),
        dateTimeReceived,
        movementStatus: "Received",
        proofReference: proofReference.trim(),
        proofPhotoDataUrl,
        receiverConfirmation: confirmation.trim(),
        eventType: "acknowledgment",
        remarks: remarks.trim(),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="document-form" onSubmit={submit}>
      <div className="acknowledgment-note">
        This confirms who physically received {document.type} {document.requestNo} and the exact date and time.
      </div>
      <div className="form-grid">
        <SmartInput label="Received by" value={receivedBy} options={ROUTE_CONTACTS} onChange={setReceivedBy} placeholder="Choose or type the receiver's name" required />
        <label>Date / time received<input type="datetime-local" value={dateTimeReceived} onChange={(event) => setDateTimeReceived(event.target.value)} required /></label>
        <label>Receiver initials / confirmation code<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Optional initials or PIN" /></label>
        <label>Proof reference<input value={proofReference} onChange={(event) => setProofReference(event.target.value)} placeholder="Optional logbook, stub, or receipt number" /></label>
        <label className="span-2">Remarks<textarea rows={2} value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Optional acknowledgment note" /></label>
        <ProofPhotoPicker value={proofPhotoDataUrl} onChange={setProofPhotoDataUrl} />
      </div>
      <div className="form-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
        <button className="primary-button" disabled={saving || !receivedBy.trim() || !dateTimeReceived}>{saving ? "Saving…" : "Confirm receipt"}</button>
      </div>
    </form>
  );
}
