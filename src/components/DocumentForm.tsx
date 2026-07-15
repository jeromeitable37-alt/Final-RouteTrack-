"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  DOCUMENT_TYPES,
  DocumentInput,
  DocumentRecord,
  DocumentSubmission,
  UserProfile,
} from "@/lib/types";
import { nowLocalInput, todayInput } from "@/lib/utils";
import {
  ORGANIZATIONS,
  PAYMENT_TERMS,
  ROUTE_CONTACTS,
  ROUTE_PURPOSES,
  suggestedInitialDestination,
  suggestedPurpose,
} from "@/lib/workflow";
import { SmartInput } from "./SmartInput";

function baseDocument(): DocumentInput {
  return {
    type: "PRF",
    requestNo: "",
    dateRequested: todayInput(),
    requestingDepartment: "",
    requestor: "",
    subjectPurpose: "",
    amount: 0,
    dateLogged: todayInput(),
    currentHolder: "Ms. Jorge Balela — Admin / Budget Owner",
    status: "In Transit",
    dueDate: "",
    copyType: "Original",
    physicalLocation: "",
    remarks: "",
    organization: "SISC",
    supplier: "",
    purchasingEmployee: "",
    dateForwardedSupplier: todayInput(),
    paymentTerms: "",
    itemsDescription: "",
  };
}

export function DocumentForm({
  document,
  existingDocuments,
  ownerOptions,
  ownerUid,
  onOwnerChange,
  onSubmit,
  onCancel,
}: {
  document?: DocumentRecord | null;
  existingDocuments: Pick<DocumentRecord, "id" | "type" | "requestNo">[];
  ownerOptions?: UserProfile[];
  ownerUid?: string;
  onOwnerChange?: (uid: string) => void;
  onSubmit: (submission: DocumentSubmission) => Promise<void>;
  onCancel: () => void;
}) {
  const initial = document ? {
    type: document.type,
    requestNo: document.requestNo,
    dateRequested: document.dateRequested,
    requestingDepartment: document.requestingDepartment,
    requestor: document.requestor,
    subjectPurpose: document.subjectPurpose,
    amount: document.amount,
    dateLogged: document.dateLogged,
    currentHolder: document.currentHolder,
    status: document.status,
    dueDate: document.dueDate,
    copyType: document.copyType,
    physicalLocation: document.physicalLocation,
    remarks: document.remarks,
    organization: document.organization || "",
    supplier: document.supplier || "",
    purchasingEmployee: document.purchasingEmployee || document.requestor || "",
    dateForwardedSupplier: document.dateForwardedSupplier || document.dateRequested,
    paymentTerms: document.paymentTerms || "",
    itemsDescription: document.itemsDescription || document.subjectPurpose || "",
  } satisfies DocumentInput : baseDocument();

  const [form, setForm] = useState<DocumentInput>(initial);
  const [dateTimeRouted, setDateTimeRouted] = useState(document?.lastRoutedAt || nowLocalInput());
  const [routeTo, setRouteTo] = useState(document?.currentHolder || suggestedInitialDestination(initial.type, initial.organization || "", initial.requestNo));
  const [routePurpose, setRoutePurpose] = useState(document?.lastRoutePurpose || suggestedPurpose(routeTo));
  const [routeTouched, setRouteTouched] = useState(Boolean(document));
  const [showMore, setShowMore] = useState(Boolean(document));
  const [saving, setSaving] = useState(false);

  const normalized = form.requestNo.trim().toLowerCase();
  const duplicate = Boolean(normalized) && existingDocuments.some((item) =>
    item.id !== document?.id
    && item.type === form.type
    && item.requestNo.trim().toLowerCase() === normalized
  );
  const isCrf = form.type === "CRF";
  const isPo = form.type === "PO";
  const isRequestForm = form.type === "PRF" || form.type === "SRF";

  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!form.requestNo.trim()) errors.push(`${form.type} number`);
    if (!dateTimeRouted) errors.push("date and time routed");
    if (!routeTo.trim()) errors.push("route destination");

    if (isCrf) {
      if (!form.purchasingEmployee?.trim()) errors.push("purchasing employee / requisitioner");
      if (!form.dateRequested) errors.push("CRF date");
      if (!(Number(form.amount) > 0)) errors.push("amount greater than zero");
      if (!form.supplier?.trim()) errors.push("supplier");
      if (!form.itemsDescription?.trim()) errors.push("description / items");
    }

    if (isPo) {
      if (!form.dateForwardedSupplier) errors.push("date forwarded to supplier");
      if (!form.supplier?.trim()) errors.push("supplier");
      if (!form.paymentTerms?.trim()) errors.push("payment terms");
      if (!form.itemsDescription?.trim()) errors.push("purchased product / items");
    }

    return errors;
  }, [form, dateTimeRouted, routeTo, isCrf, isPo]);

  const requiredReady = validationErrors.length === 0;

  function update<K extends keyof DocumentInput>(key: K, value: DocumentInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function applyAutoRoute(next: Partial<DocumentInput>) {
    if (routeTouched) return;
    const type = (next.type || form.type) as DocumentInput["type"];
    const organization = String(next.organization ?? form.organization ?? "");
    const requestNo = String(next.requestNo ?? form.requestNo);
    const destination = suggestedInitialDestination(type, organization, requestNo);
    setRouteTo(destination);
    setRoutePurpose(suggestedPurpose(destination));
  }

  function changeType(type: DocumentInput["type"]) {
    const next: DocumentInput = { ...form, type };
    if (type === "PO") next.status = "In Transit";
    setForm(next);
    applyAutoRoute({ type });
  }

  function changeRequestNo(requestNo: string) {
    update("requestNo", requestNo);
    applyAutoRoute({ requestNo });
  }

  function changeOrganization(organization: string) {
    update("organization", organization);
    applyAutoRoute({ organization });
  }

  function changeRouteTo(value: string) {
    setRouteTouched(true);
    setRouteTo(value);
    setRoutePurpose(suggestedPurpose(value));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (duplicate || !requiredReady) return;
    setSaving(true);
    try {
      const description = String(form.itemsDescription || form.subjectPurpose || `${form.type} ${form.requestNo}`).trim();
      const requestor = String(form.purchasingEmployee || form.requestor || "").trim();
      const documentInput: DocumentInput = {
        ...form,
        requestor,
        purchasingEmployee: requestor,
        subjectPurpose: description,
        itemsDescription: description,
        dateLogged: dateTimeRouted.slice(0, 10),
        currentHolder: routeTo.trim(),
        status: document ? form.status : "In Transit",
      };
      await onSubmit({
        document: documentInput,
        initialRoute: {
          dateTimeRouted,
          fromOffice: "Student Assistant / Records",
          toOffice: routeTo.trim(),
          actionPurpose: routePurpose.trim() || suggestedPurpose(routeTo),
          receivedBy: "",
          dateTimeReceived: "",
          movementStatus: "Routed",
          proofReference: "",
          remarks: form.remarks,
        },
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="document-form quick-log-form" onSubmit={submit}>
      <section className="quick-form-intro">
        <div><p className="eyebrow">QUICK ROUTING ENTRY</p><h3>{document ? "Update document information" : "Record the document before releasing it"}</h3></div>
        <span>Only the fields marked required must be completed.</span>
      </section>

      <div className="form-grid">
        {ownerOptions && ownerOptions.length > 0 && <label className="span-2">Record owner<select value={ownerUid} onChange={(event) => onOwnerChange?.(event.target.value)} disabled={Boolean(document)}>{ownerOptions.map((owner) => <option key={owner.uid} value={owner.uid}>{owner.displayName} — {owner.department || owner.email}</option>)}</select></label>}

        <label>Document type<select value={form.type} onChange={(event) => changeType(event.target.value as DocumentInput["type"])}>{DOCUMENT_TYPES.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>{form.type} number<input value={form.requestNo} onChange={(event) => changeRequestNo(event.target.value)} placeholder={`Enter ${form.type} number`} required />{duplicate && <span className="field-error">This document number already exists.</span>}</label>

        <label>Date and time routed<input type="datetime-local" value={dateTimeRouted} onChange={(event) => setDateTimeRouted(event.target.value)} required /></label>
        <SmartInput label="Organization / company" value={form.organization || ""} options={ORGANIZATIONS} onChange={changeOrganization} placeholder="Choose or type organization" />

        <SmartInput className="span-2" label={document ? "Current holder / office" : "Route to person / department"} value={routeTo} options={ROUTE_CONTACTS} onChange={changeRouteTo} placeholder="Choose a common person or type another name" required help="You can select a suggestion or type any other person or department." />
        {!document && <SmartInput className="span-2" label="Purpose of routing" value={routePurpose} options={ROUTE_PURPOSES} onChange={setRoutePurpose} placeholder="Choose or type the routing purpose" required />}

        {isCrf && <>
          <label>Purchasing employee / requisitioner<input value={form.purchasingEmployee || ""} onChange={(event) => update("purchasingEmployee", event.target.value)} required /></label>
          <label>CRF date<input type="date" value={form.dateRequested} onChange={(event) => update("dateRequested", event.target.value)} required /></label>
          <label>Amount<input type="number" min="0.01" step="0.01" value={form.amount || ""} onChange={(event) => update("amount", Number(event.target.value))} required /></label>
          <label>Supplier<input value={form.supplier || ""} onChange={(event) => update("supplier", event.target.value)} required /></label>
          <label className="span-2">Description / items<textarea rows={3} value={form.itemsDescription || ""} onChange={(event) => update("itemsDescription", event.target.value)} required /></label>
        </>}

        {isPo && <>
          <label>Date forwarded to supplier<input type="date" value={form.dateForwardedSupplier || ""} onChange={(event) => update("dateForwardedSupplier", event.target.value)} required /></label>
          <SmartInput label="Terms" value={form.paymentTerms || ""} options={PAYMENT_TERMS} onChange={(paymentTerms) => update("paymentTerms", paymentTerms)} placeholder="Choose or type terms" required />
          <label>Supplier<input value={form.supplier || ""} onChange={(event) => update("supplier", event.target.value)} required /></label>
          <label>Purchasing employee<input value={form.purchasingEmployee || ""} onChange={(event) => update("purchasingEmployee", event.target.value)} /></label>
          <label className="span-2">Purchased product / items<textarea rows={3} value={form.itemsDescription || ""} onChange={(event) => update("itemsDescription", event.target.value)} required /></label>
        </>}
      </div>

      {isRequestForm && <div className="optional-toggle"><button type="button" className="text-button" onClick={() => setShowMore((current) => !current)}>{showMore ? "Hide optional details" : "Add optional request details"}</button></div>}

      {(showMore || document) && isRequestForm && <div className="form-grid optional-fields">
        <label>Requested by / employee<input value={form.purchasingEmployee || ""} onChange={(event) => update("purchasingEmployee", event.target.value)} /></label>
        <label>Document date<input type="date" value={form.dateRequested} onChange={(event) => update("dateRequested", event.target.value)} /></label>
        <label>Amount<input type="number" min="0" step="0.01" value={form.amount || ""} onChange={(event) => update("amount", Number(event.target.value))} /></label>
        <label>Supplier<input value={form.supplier || ""} onChange={(event) => update("supplier", event.target.value)} /></label>
        <label className="span-2">Description / items<textarea rows={2} value={form.itemsDescription || ""} onChange={(event) => update("itemsDescription", event.target.value)} /></label>
      </div>}

      <div className="form-grid form-bottom-fields">
        <label className="span-2">Remarks<textarea rows={2} value={form.remarks} onChange={(event) => update("remarks", event.target.value)} placeholder="Optional notes" /></label>
      </div>

      {(duplicate || validationErrors.length > 0) && <div className="form-validation-summary" role="alert">
        {duplicate ? <strong>A {form.type} with this number already exists.</strong> : <><strong>Complete these fields before saving:</strong><span>{validationErrors.join(", ")}.</span></>}
      </div>}

      <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button className="primary-button" disabled={saving || duplicate || !requiredReady}>{saving ? "Saving…" : document ? "Save changes" : "Save and record route"}</button></div>
    </form>
  );
}
