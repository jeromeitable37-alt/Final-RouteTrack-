"use client";

import { useEffect, useState } from "react";
import {
  Archive,
  ArrowRight,
  CheckCircle2,
  Edit3,
  MapPin,
  Plus,
  Printer,
  QrCode,
  RotateCcw,
  ShieldAlert,
  Undo2,
  UserCheck,
  UserRound,
} from "lucide-react";
import QRCode from "qrcode";
import { DocumentRecord, RoutingInput, RoutingRecord, SessionUser } from "@/lib/types";
import {
  addActivityLog,
  addRoute,
  migrateLocalLegacyRoutes,
  subscribeRoutes,
  updateDocument,
} from "@/lib/data-service";
import { formatCurrency, formatDate, formatDateTime, statusClass } from "@/lib/utils";
import { Modal } from "./Modal";
import { RoutingForm } from "./RoutingForm";
import { AcknowledgmentForm } from "./AcknowledgmentForm";

function routeSearchText(input: RoutingInput): string {
  return [
    input.fromOffice,
    input.toOffice,
    input.actionPurpose,
    input.receivedBy,
    input.proofReference,
    input.receiverConfirmation,
  ].filter(Boolean).join(" ");
}

export function DocumentDetails({ user, document, onEdit, notify }: {
  user: SessionUser;
  document: DocumentRecord;
  onEdit: () => void;
  notify: (message: string, error?: boolean) => void;
}) {
  const [routes, setRoutes] = useState<RoutingRecord[]>([]);
  const [routingOpen, setRoutingOpen] = useState(false);
  const [acknowledgmentOpen, setAcknowledgmentOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    let unsubscribe: () => void = () => {};
    void migrateLocalLegacyRoutes(document.ownerUid, document.id).finally(() => {
      unsubscribe = subscribeRoutes(document.id, setRoutes);
    });
    return () => unsubscribe();
  }, [document.id, document.ownerUid]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("document", document.id);
    void QRCode.toDataURL(url.toString(), { width: 220, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [document.id]);

  const isCrf = document.type === "CRF";
  const isPo = document.type === "PO";
  const isSingleRouteDocument = isCrf || isPo;
  const normalizedStatus = String(document.status || "").trim().toLowerCase();
  const closed = normalizedStatus === "completed" || normalizedStatus === "cancelled";
  const archived = Boolean(document.archivedAt);
  const canAcknowledge = !archived && !closed && !document.lastReceivedBy;

  async function saveRoute(input: RoutingInput) {
    if (isSingleRouteDocument) {
      notify(`${document.type} is already Completed. No additional routing is required.`, true);
      return;
    }

    try {
      await addRoute(user, document.id, input);
      const status = input.movementStatus === "Received"
        ? "Received"
        : input.movementStatus === "Returned"
          ? "Returned for Correction"
          : input.movementStatus === "On Hold"
            ? "Under Review"
            : "In Transit";
      await updateDocument(document.id, {
        currentHolder: input.toOffice,
        status,
        routeCount: document.routeCount + 1,
        lastRoutedAt: input.dateTimeRouted,
        lastFromOffice: input.fromOffice,
        lastToOffice: input.toOffice,
        lastRoutePurpose: input.actionPurpose,
        lastReceivedBy: input.receivedBy,
        lastReceivedAt: input.dateTimeReceived,
        lastMovementStatus: input.movementStatus,
        lastRouteEncodedBy: user.displayName || user.email,
        lastProofReference: input.proofReference,
        routeSearchText: `${document.routeSearchText || ""} ${routeSearchText(input)}`.trim(),
      });
      await addActivityLog(user, "ROUTED", `${document.type} ${document.requestNo} routed to ${input.toOffice}.`, document);
      setRoutingOpen(false);
      notify("Routing handoff recorded.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to record the routing entry.", true);
    }
  }

  async function saveAcknowledgment(input: RoutingInput) {
    try {
      await addRoute(user, document.id, input);
      await updateDocument(document.id, {
        status: "Received",
        lastReceivedBy: input.receivedBy,
        lastReceivedAt: input.dateTimeReceived,
        lastMovementStatus: "Received",
        lastProofReference: input.proofReference,
        routeSearchText: `${document.routeSearchText || ""} ${routeSearchText(input)}`.trim(),
      });
      await addActivityLog(user, "ACKNOWLEDGED", `${document.type} ${document.requestNo} received by ${input.receivedBy}.`, document);
      setAcknowledgmentOpen(false);
      notify(`Receipt confirmed by ${input.receivedBy}.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to save the acknowledgment.", true);
    }
  }

  async function quickStatus(status: DocumentRecord["status"], note: string) {
    try {
      const now = new Date().toISOString();
      await updateDocument(document.id, {
        status,
        completedAt: status === "Completed" ? now : "",
      });
      await addActivityLog(user, "STATUS", `${document.type} ${document.requestNo}: ${note}`, document);
      notify(note);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to update the status.", true);
    }
  }

  async function toggleArchive() {
    try {
      if (archived) {
        await updateDocument(document.id, { archivedAt: "", archivedBy: "" });
        await addActivityLog(user, "RESTORED", `${document.type} ${document.requestNo} restored from archive.`, document);
        notify("Document restored from archive.");
      } else {
        if (!window.confirm(`Archive ${document.type} ${document.requestNo}? It can be restored later.`)) return;
        await updateDocument(document.id, {
          archivedAt: new Date().toISOString(),
          archivedBy: user.displayName || user.email,
        });
        await addActivityLog(user, "ARCHIVED", `${document.type} ${document.requestNo} archived.`, document);
        notify("Document archived. It was not permanently deleted.");
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to update the archive.", true);
    }
  }

  return (
    <>
      <div className="detail-toolbar no-print">
        <button className="secondary-button" onClick={() => window.print()}><Printer size={16} /> Print</button>
        {!archived && <button className="secondary-button" onClick={onEdit}><Edit3 size={16} /> Edit</button>}
        {canAcknowledge && <button className="secondary-button" onClick={() => setAcknowledgmentOpen(true)}><UserCheck size={16} /> Acknowledge</button>}
        {!archived && normalizedStatus !== "completed" && <button className="status-action status-complete-action" onClick={() => void quickStatus("Completed", "Document marked Completed.")}><CheckCircle2 size={16} /> Completed</button>}
        {!archived && normalizedStatus !== "missing" && <button className="status-action status-missing-action" onClick={() => void quickStatus("Missing", "Document marked Missing for immediate follow-up.")}><ShieldAlert size={16} /> Missing</button>}
        {!archived && normalizedStatus !== "returned for correction" && <button className="secondary-button" onClick={() => void quickStatus("Returned for Correction", "Document marked Returned for Correction.")}><Undo2 size={16} /> Returned</button>}
        <button className="secondary-button" onClick={() => void toggleArchive()}>{archived ? <RotateCcw size={16} /> : <Archive size={16} />}{archived ? " Restore" : " Archive"}</button>
        {!isSingleRouteDocument && !archived && !closed && (
          <button className="primary-button" onClick={() => setRoutingOpen(true)}><Plus size={16} /> Route next</button>
        )}
      </div>

      <section className="print-sheet">
        <div className="detail-title-row">
          <div><p className="eyebrow">{document.type} ROUTING RECORD</p><h3>{document.requestNo}</h3><p>{document.itemsDescription || document.subjectPurpose || "No description entered"}</p></div>
          <div className="detail-badges"><span className={statusClass(document.status)}>{document.status}</span>{archived && <span className="archive-pill">Archived</span>}</div>
        </div>

        <div className="document-owner-banner"><UserRound size={19} /><div><span>Recorded by</span><strong>{document.ownerName || document.ownerEmail}</strong><small>{document.ownerEmail}</small></div></div>

        <div className="detail-grid">
          <div><span>Document number</span><strong>{document.requestNo}</strong></div>
          <div><span>Organization</span><strong>{document.organization || "Not recorded"}</strong></div>
          <div><span>Document date</span><strong>{formatDate(document.dateRequested)}</strong></div>
          <div><span>Last routed</span><strong>{formatDateTime(document.lastRoutedAt || document.createdAt)}</strong></div>
          {(isCrf || isPo || document.purchasingEmployee) && <div><span>Purchasing employee / requisitioner</span><strong>{document.purchasingEmployee || document.requestor || "Not recorded"}</strong></div>}
          {(isCrf || isPo || document.supplier) && <div><span>Supplier</span><strong>{document.supplier || "Not recorded"}</strong></div>}
          {(isCrf || document.amount > 0) && <div><span>Amount</span><strong>{formatCurrency(document.amount)}</strong></div>}
          {isPo && <div><span>Date forwarded to supplier</span><strong>{formatDate(document.dateForwardedSupplier || "")}</strong></div>}
          {isPo && <div><span>Payment terms</span><strong>{document.paymentTerms || "Not recorded"}</strong></div>}
          <div><span>Route count</span><strong>{document.routeCount}</strong></div>
          <div><span>Last acknowledgment</span><strong>{document.lastReceivedBy || "Pending"}</strong></div>
        </div>

        <div className="current-location"><MapPin size={20} /><div><span>Current holder / office</span><strong>{document.currentHolder}</strong></div></div>
        {isSingleRouteDocument && (
          <div className="remarks-box"><span>Routing status</span><p>{document.type} is completed after its first routing entry. No Route next action is required.</p></div>
        )}
        {(document.itemsDescription || document.subjectPurpose) && <div className="remarks-box"><span>Description / items</span><p>{document.itemsDescription || document.subjectPurpose}</p></div>}
        {document.remarks && <div className="remarks-box"><span>Remarks</span><p>{document.remarks}</p></div>}

        {qrDataUrl && <div className="document-qr-block">
          <div><p className="eyebrow">SCAN TO TRACE</p><strong>Open this document record on a phone</strong><span>Sign in first when required.</span></div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt={`QR code for ${document.type} ${document.requestNo}`} />
        </div>}

        <div className="section-heading"><div><p className="eyebrow">CHAIN OF CUSTODY</p><h3>Complete routing history</h3></div><span>{routes.length} event{routes.length === 1 ? "" : "s"}</span></div>
        {routes.length ? <div className="timeline">{routes.map((route) => {
          const acknowledgment = route.eventType === "acknowledgment";
          return <article className={`timeline-item ${acknowledgment ? "timeline-acknowledgment" : ""}`} key={route.id}>
            <div className="timeline-dot" />
            <div className="timeline-card">
              <div className="route-line">
                {acknowledgment ? <><UserCheck size={17} /><strong>Receipt acknowledged by {route.receivedBy}</strong></> : <><strong>{route.fromOffice}</strong><ArrowRight size={16} /><strong>{route.toOffice}</strong></>}
              </div>
              <p>{route.actionPurpose}</p>
              <div className="route-meta">
                <span>{acknowledgment ? "Acknowledged" : "Routed"}: {formatDateTime(acknowledgment ? route.dateTimeReceived : route.dateTimeRouted)}</span>
                <span>Status: {route.movementStatus}</span>
                <span>Received by: {route.receivedBy || "No acknowledgment"}</span>
                {!acknowledgment && <span>Received: {formatDateTime(route.dateTimeReceived)}</span>}
                <span>Encoded by: {route.createdByName || "User"}</span>
                {route.receiverConfirmation && <span>Confirmation: {route.receiverConfirmation}</span>}
              </div>
              {route.proofReference && <p className="proof-ref">Proof reference: {route.proofReference}</p>}
              {route.proofPhotoDataUrl && <div className="route-proof-photo">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={route.proofPhotoDataUrl} alt="Routing proof" /></div>}
              {route.remarks && <p className="muted">{route.remarks}</p>}
            </div>
          </article>;
        })}</div> : <div className="empty-panel">No routing history yet.</div>}
      </section>

      {!isSingleRouteDocument && routingOpen && <Modal title="Record next handoff" onClose={() => setRoutingOpen(false)}><RoutingForm document={document} onSubmit={saveRoute} onCancel={() => setRoutingOpen(false)} /></Modal>}
      {acknowledgmentOpen && <Modal title="Confirm document receipt" onClose={() => setAcknowledgmentOpen(false)}><AcknowledgmentForm document={document} onSubmit={saveAcknowledgment} onCancel={() => setAcknowledgmentOpen(false)} /></Modal>}
    </>
  );
}