"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Edit3, MapPin, Plus, Printer, Trash2, UserRound } from "lucide-react";
import { DocumentRecord, RoutingInput, RoutingRecord, SessionUser } from "@/lib/types";
import { addRoute, migrateLocalLegacyRoutes, subscribeRoutes, updateDocument } from "@/lib/data-service";
import { formatCurrency, formatDate, formatDateTime, statusClass } from "@/lib/utils";
import { Modal } from "./Modal";
import { RoutingForm } from "./RoutingForm";

export function DocumentDetails({ user, document, onEdit, onDelete, notify }: {
  user: SessionUser;
  document: DocumentRecord;
  onEdit: () => void;
  onDelete: () => void;
  notify: (message: string, error?: boolean) => void;
}) {
  const [routes, setRoutes] = useState<RoutingRecord[]>([]);
  const [routingOpen, setRoutingOpen] = useState(false);

  useEffect(() => {
    let unsubscribe: () => void = () => {};
    void migrateLocalLegacyRoutes(document.ownerUid, document.id).finally(() => {
      unsubscribe = subscribeRoutes(document.id, setRoutes);
    });
    return () => unsubscribe();
  }, [document.id, document.ownerUid]);

  const isCrf = document.type === "CRF";
  const isPo = document.type === "PO";
  const isSingleRouteDocument = isCrf || isPo;

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
      });
      setRoutingOpen(false);
      notify("Routing handoff recorded.");
    } catch {
      notify("Unable to record the routing entry.", true);
    }
  }

  return (
    <>
      <div className="detail-toolbar no-print">
        <button className="secondary-button" onClick={() => window.print()}><Printer size={16} /> Print</button>
        <button className="secondary-button" onClick={onEdit}><Edit3 size={16} /> Edit</button>
        <button className="danger-button" onClick={onDelete}><Trash2 size={16} /> Delete</button>
        {!isSingleRouteDocument && (
          <button className="primary-button" onClick={() => setRoutingOpen(true)}><Plus size={16} /> Route next</button>
        )}
      </div>

      <section className="print-sheet">
        <div className="detail-title-row">
          <div><p className="eyebrow">{document.type} ROUTING RECORD</p><h3>{document.requestNo}</h3><p>{document.itemsDescription || document.subjectPurpose || "No description entered"}</p></div>
          <div className="detail-badges"><span className={statusClass(document.status)}>{document.status}</span></div>
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
        </div>

        <div className="current-location"><MapPin size={20} /><div><span>Current holder / office</span><strong>{document.currentHolder}</strong></div></div>
        {isSingleRouteDocument && (
          <div className="remarks-box">
            <span>Routing status</span>
            <p>{document.type} is completed after its first routing entry. No Route next action is required.</p>
          </div>
        )}
        {(document.itemsDescription || document.subjectPurpose) && <div className="remarks-box"><span>Description / items</span><p>{document.itemsDescription || document.subjectPurpose}</p></div>}
        {document.remarks && <div className="remarks-box"><span>Remarks</span><p>{document.remarks}</p></div>}

        <div className="section-heading"><div><p className="eyebrow">CHAIN OF CUSTODY</p><h3>Complete routing history</h3></div><span>{routes.length} movement{routes.length === 1 ? "" : "s"}</span></div>
        {routes.length ? <div className="timeline">{routes.map((route) => <article className="timeline-item" key={route.id}><div className="timeline-dot" /><div className="timeline-card"><div className="route-line"><strong>{route.fromOffice}</strong><ArrowRight size={16} /><strong>{route.toOffice}</strong></div><p>{route.actionPurpose}</p><div className="route-meta"><span>Routed: {formatDateTime(route.dateTimeRouted)}</span><span>Status: {route.movementStatus}</span><span>Received by: {route.receivedBy || "No acknowledgment"}</span><span>Received: {formatDateTime(route.dateTimeReceived)}</span><span>Encoded by: {route.createdByName || "User"}</span></div>{route.proofReference && <p className="proof-ref">Proof: {route.proofReference}</p>}{route.remarks && <p className="muted">{route.remarks}</p>}</div></article>)}</div> : <div className="empty-panel">No routing history yet.</div>}
      </section>

      {!isSingleRouteDocument && routingOpen && <Modal title="Record next handoff" onClose={() => setRoutingOpen(false)}><RoutingForm document={document} onSubmit={saveRoute} onCancel={() => setRoutingOpen(false)} /></Modal>}
    </>
  );
}