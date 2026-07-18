"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  ClipboardList,
  FileSearch,
  MessageCircle,
  QrCode,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { DocumentRecord } from "@/lib/types";

export interface CommandAction {
  id: string;
  label: string;
  description: string;
  icon: "dashboard" | "documents" | "messages" | "scanner" | "reports";
  run: () => void;
}

function ActionIcon({ type }: { type: CommandAction["icon"] }) {
  if (type === "dashboard") return <BarChart3 size={18} />;
  if (type === "documents") return <ClipboardList size={18} />;
  if (type === "messages") return <MessageCircle size={18} />;
  if (type === "scanner") return <QrCode size={18} />;
  return <Sparkles size={18} />;
}

export function CommandPalette({
  documents,
  actions,
  onOpenDocument,
}: {
  documents: DocumentRecord[];
  actions: CommandAction[];
  onOpenDocument: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    window.setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  const normalized = query.trim().toLowerCase();
  const matchingActions = actions.filter((item) => `${item.label} ${item.description}`.toLowerCase().includes(normalized));
  const matchingDocuments = useMemo(() => {
    if (!normalized) return documents.slice(0, 6);
    return documents.filter((item) => [
      item.type,
      item.requestNo,
      item.trackingId,
      item.currentHolder,
      item.supplier,
      item.purchasingEmployee,
      item.requestor,
      item.organization,
      item.status,
      item.routeSearchText,
    ].filter(Boolean).join(" ").toLowerCase().includes(normalized)).slice(0, 10);
  }, [documents, normalized]);

  function finish(action: () => void) {
    action();
    setOpen(false);
  }

  return (
    <>
      <button className="command-trigger" onClick={() => setOpen(true)}>
        <Search size={17} /><span>Search or run a command</span><kbd>Ctrl K</kbd>
      </button>
      {open && (
        <div className="command-overlay" onMouseDown={() => setOpen(false)}>
          <section className="command-palette" onMouseDown={(event) => event.stopPropagation()}>
            <header><Search size={20} /><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search documents, approvers, suppliers, or commands…" /><button className="icon-button" onClick={() => setOpen(false)}><X size={17} /></button></header>
            <div className="command-results">
              <p className="command-section-label">Commands</p>
              {matchingActions.map((item) => (
                <button key={item.id} onClick={() => finish(item.run)}>
                  <div className="command-result-icon"><ActionIcon type={item.icon} /></div>
                  <span><strong>{item.label}</strong><small>{item.description}</small></span>
                </button>
              ))}
              <p className="command-section-label">Documents</p>
              {matchingDocuments.map((item) => (
                <button key={item.id} onClick={() => finish(() => onOpenDocument(item.id))}>
                  <div className="command-result-icon"><FileSearch size={18} /></div>
                  <span><strong>{item.type} {item.requestNo}</strong><small>{item.currentHolder} · {item.status}</small></span>
                </button>
              ))}
              {!matchingActions.length && !matchingDocuments.length && <div className="empty-panel">No matching command or document.</div>}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
