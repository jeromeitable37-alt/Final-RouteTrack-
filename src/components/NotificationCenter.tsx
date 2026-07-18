"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, BellRing, CheckCircle2, MessageCircle, ShieldAlert, X } from "lucide-react";
import { DocumentRecord, SessionUser } from "@/lib/types";
import { PushNotificationSettings } from "./PushNotificationSettings";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  documentId?: string;
  severity: "danger" | "warning" | "info";
}

function normalize(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function ageDays(value: unknown): number {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? 0 : Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
}

export function NotificationCenter({
  documents,
  unreadMessages,
  onOpenDocument,
  onOpenMessages,
  user,
  notify,
}: {
  documents: DocumentRecord[];
  unreadMessages: number;
  onOpenDocument: (id: string) => void;
  onOpenMessages: () => void;
  user: SessionUser;
  notify: (message: string, error?: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setDismissed(JSON.parse(localStorage.getItem("routetrack-dismissed-notifications") || "[]"));
    } catch {
      setDismissed([]);
    }
  }, []);

  const items = useMemo<NotificationItem[]>(() => {
    const generated: NotificationItem[] = [];
    documents.filter((item) => !item.archivedAt).forEach((item) => {
      const status = normalize(item.status);
      const name = `${item.type} ${item.requestNo}`;
      if (status === "missing") generated.push({ id: `missing:${item.id}`, title: `${name} is missing`, body: `Current holder: ${item.currentHolder || "Not recorded"}`, documentId: item.id, severity: "danger" });
      if (status.includes("returned")) generated.push({ id: `returned:${item.id}:${item.updatedAt}`, title: `${name} was returned`, body: "Review the correction requirement and record the next action.", documentId: item.id, severity: "warning" });
      if (item.lastRoutedAt && !item.lastReceivedBy && ageDays(item.lastRoutedAt) >= 1) generated.push({ id: `ack:${item.id}:${item.lastRoutedAt}`, title: `${name} has no acknowledgment`, body: `${ageDays(item.lastRoutedAt)} day(s) since routing to ${item.currentHolder}.`, documentId: item.id, severity: "warning" });
      if (item.nextFollowUpAt && new Date(item.nextFollowUpAt).getTime() <= Date.now()) generated.push({ id: `followup:${item.id}:${item.nextFollowUpAt}`, title: `Follow-up due for ${name}`, body: `Current holder: ${item.currentHolder}`, documentId: item.id, severity: "info" });
    });
    if (unreadMessages > 0) generated.unshift({ id: `messages:${unreadMessages}`, title: `${unreadMessages} unread message${unreadMessages === 1 ? "" : "s"}`, body: "Open Purchasing team messages.", severity: "info" });
    return generated.filter((item) => !dismissed.includes(item.id)).slice(0, 30);
  }, [documents, dismissed, unreadMessages]);


  function dismiss(id: string) {
    const next = [...dismissed, id].slice(-100);
    setDismissed(next);
    localStorage.setItem("routetrack-dismissed-notifications", JSON.stringify(next));
  }


  return (
    <div className="notification-center" ref={panelRef}>
      <button className="topbar-icon-button" onClick={() => setOpen((value) => !value)} aria-label="Open notifications">
        {items.length ? <BellRing size={19} /> : <Bell size={19} />}
        {items.length > 0 && <span>{Math.min(99, items.length)}</span>}
      </button>
      {open && (
        <section className="notification-popover">
          <header><div><p className="eyebrow">NOTIFICATIONS</p><h3>What needs attention</h3></div><button className="icon-button" onClick={() => setOpen(false)}><X size={17} /></button></header>
          <PushNotificationSettings user={user} notify={notify} />
          <div className="notification-list">
            {items.map((item) => (
              <article key={item.id} className={`notification-item notification-${item.severity}`}>
                <button className="notification-main" onClick={() => {
                  if (item.documentId) onOpenDocument(item.documentId); else onOpenMessages();
                  setOpen(false);
                }}>
                  <div>{item.severity === "danger" ? <ShieldAlert size={18} /> : item.id.startsWith("messages") ? <MessageCircle size={18} /> : <Bell size={18} />}</div>
                  <span><strong>{item.title}</strong><small>{item.body}</small></span>
                </button>
                <button className="notification-dismiss" onClick={() => dismiss(item.id)} aria-label="Dismiss"><X size={14} /></button>
              </article>
            ))}
            {!items.length && <div className="notification-clear"><CheckCircle2 size={24} /><strong>You are all caught up.</strong><span>No current alert requires action.</span></div>}
          </div>
        </section>
      )}
    </div>
  );
}
