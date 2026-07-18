"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import {
  Bot,
  ChevronDown,
  FileSearch,
  Loader2,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { DocumentRecord, SessionUser } from "@/lib/types";

interface AssistantMessage {
  id: string;
  role: "assistant" | "user";
  text: string;
  documentIds?: string[];
  source?: "live-data" | "ai";
}

interface LocalReply {
  text: string;
  documentIds?: string[];
  confidence: "high" | "low";
}

const QUICK_PROMPTS = [
  "What needs attention today?",
  "Show pending acknowledgments",
  "How many documents this month?",
  "Which files are staying over 3 days?",
];

const COMMON_WORDS = new Set([
  "where", "is", "the", "document", "file", "find", "show", "me", "all",
  "documents", "files", "with", "from", "to", "who", "currently", "current",
  "holder", "approver", "received", "by", "please", "check", "search", "for",
]);

function normalize(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function safeDate(value: unknown): Date | null {
  const text = String(value || "").trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function ageInDays(value: unknown): number {
  const date = safeDate(value);
  if (!date) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
}

function documentText(item: DocumentRecord, routeText: string): string {
  return [
    item.type,
    item.requestNo,
    item.trackingId,
    item.organization,
    item.supplier,
    item.requestor,
    item.purchasingEmployee,
    item.requestingDepartment,
    item.subjectPurpose,
    item.itemsDescription,
    item.currentHolder,
    item.lastFromOffice,
    item.lastToOffice,
    item.lastRoutePurpose,
    item.lastReceivedBy,
    item.status,
    routeText,
  ].filter(Boolean).join(" ").toLowerCase();
}

function currentMonthDocuments(documents: DocumentRecord[]): DocumentRecord[] {
  const now = new Date();
  return documents.filter((item) => {
    const date = safeDate(item.dateRequested || item.dateLogged || item.createdAt);
    return date && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  });
}

function labelList(items: DocumentRecord[], maximum = 6): string {
  return items.slice(0, maximum).map((item) =>
    `${item.type} ${item.requestNo} — ${item.status}, current holder: ${item.currentHolder || "not recorded"}`
  ).join("\n");
}

function localAnswer(
  question: string,
  documents: DocumentRecord[],
  routeHistoryIndex: Record<string, string>,
): LocalReply {
  const query = normalize(question);
  const active = documents.filter((item) => !item.archivedAt);

  if (!query || /^(hi|hello|hey|help|good morning|good afternoon)/.test(query)) {
    return {
      confidence: "high",
      text: "I can search a document or approver, count monthly requests, identify pending acknowledgments, find stalled files, and summarize your visible RouteTrack records. Try: “Where is PRF 2026-001?”",
    };
  }

  const pending = active.filter((item) => {
    const status = normalize(item.status);
    return status !== "completed" && status !== "cancelled" && !item.lastReceivedBy && ageInDays(item.lastRoutedAt || item.createdAt) >= 1;
  });

  const stalled = active.filter((item) => {
    const status = normalize(item.status);
    return status !== "completed" && status !== "cancelled" && ageInDays(item.lastRoutedAt || item.updatedAt || item.createdAt) >= 3;
  });

  const missing = active.filter((item) => normalize(item.status) === "missing");
  const returned = active.filter((item) => normalize(item.status).includes("returned"));

  if (query.includes("attention") || query.includes("priority") || query.includes("urgent")) {
    const combined = [...missing, ...returned, ...pending, ...stalled].filter(
      (item, index, array) => array.findIndex((candidate) => candidate.id === item.id) === index,
    );
    return {
      confidence: "high",
      text: combined.length
        ? `I found ${combined.length} file(s) that may need attention.\n${labelList(combined)}`
        : "No urgent file was detected. There are no missing, returned, old unacknowledged, or stalled records in your current view.",
      documentIds: combined.slice(0, 6).map((item) => item.id),
    };
  }

  if (query.includes("acknowledg") || query.includes("unreceived") || query.includes("not received")) {
    return {
      confidence: "high",
      text: pending.length
        ? `${pending.length} document(s) have no acknowledgment after at least one day.\n${labelList(pending)}`
        : "No document currently matches the pending-acknowledgment rule.",
      documentIds: pending.slice(0, 6).map((item) => item.id),
    };
  }

  if (query.includes("over 3") || query.includes("three day") || query.includes("stalled") || query.includes("overdue")) {
    return {
      confidence: "high",
      text: stalled.length
        ? `${stalled.length} active document(s) have stayed without a new route for at least three days.\n${labelList(stalled)}`
        : "No active document has stayed without a new route for three days or more.",
      documentIds: stalled.slice(0, 6).map((item) => item.id),
    };
  }

  if (query.includes("this month") || query.includes("monthly") || query.includes("month")) {
    const monthItems = currentMonthDocuments(active);
    const counts = ["PRF", "SRF", "CRF", "PO"].map((type) =>
      `${type}: ${monthItems.filter((item) => item.type === type).length}`
    ).join(", ");
    return {
      confidence: "high",
      text: `${monthItems.length} document(s) were requested this month. ${counts}.`,
      documentIds: monthItems.slice(0, 6).map((item) => item.id),
    };
  }

  if (query.includes("missing")) {
    return {
      confidence: "high",
      text: missing.length ? `${missing.length} document(s) are marked Missing.\n${labelList(missing)}` : "No document is currently marked Missing.",
      documentIds: missing.slice(0, 6).map((item) => item.id),
    };
  }

  if (query.includes("returned")) {
    return {
      confidence: "high",
      text: returned.length ? `${returned.length} document(s) are returned for correction.\n${labelList(returned)}` : "No document is currently returned for correction.",
      documentIds: returned.slice(0, 6).map((item) => item.id),
    };
  }

  if (query.includes("completed")) {
    const completed = active.filter((item) => normalize(item.status) === "completed");
    return {
      confidence: "high",
      text: `${completed.length} document(s) are marked Completed in your current view.`,
      documentIds: completed.slice(0, 6).map((item) => item.id),
    };
  }

  const directMatches = active.filter((item) => {
    const text = documentText(item, routeHistoryIndex[item.id] || "");
    if (text.includes(query)) return true;
    const tokens = query.split(/\s+/).filter((word) => word.length > 1 && !COMMON_WORDS.has(word));
    return tokens.length > 0 && tokens.every((word) => text.includes(word));
  });

  if (directMatches.length) {
    return {
      confidence: "high",
      text: directMatches.length === 1
        ? `${directMatches[0].type} ${directMatches[0].requestNo} is currently with ${directMatches[0].currentHolder || "an unrecorded holder"}. Status: ${directMatches[0].status}. Last routed: ${directMatches[0].lastRoutedAt ? new Date(directMatches[0].lastRoutedAt).toLocaleString() : "not recorded"}.`
        : `I found ${directMatches.length} matching document(s).\n${labelList(directMatches)}`,
      documentIds: directMatches.slice(0, 8).map((item) => item.id),
    };
  }

  return {
    confidence: "low",
    text: "I could not find an exact answer from the visible records. Try including the document number, approver, supplier, status, or month.",
  };
}

function compactDocuments(documents: DocumentRecord[], routeHistoryIndex: Record<string, string>) {
  return [...documents]
    .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))
    .slice(0, 100)
    .map((item) => ({
      id: item.id,
      type: item.type,
      requestNo: item.requestNo,
      dateRequested: item.dateRequested,
      dateLogged: item.dateLogged,
      organization: item.organization || "",
      supplier: item.supplier || "",
      purchasingEmployee: item.purchasingEmployee || item.requestor || "",
      purpose: item.itemsDescription || item.subjectPurpose || "",
      currentHolder: item.currentHolder,
      status: item.status,
      dueDate: item.dueDate,
      lastRoutedAt: item.lastRoutedAt || "",
      lastFromOffice: item.lastFromOffice || "",
      lastToOffice: item.lastToOffice || "",
      lastRoutePurpose: item.lastRoutePurpose || "",
      lastReceivedBy: item.lastReceivedBy || "",
      lastReceivedAt: item.lastReceivedAt || "",
      routeHistorySearchText: routeHistoryIndex[item.id] || item.routeSearchText || "",
    }));
}

export function RouteTrackAssistant({
  documents,
  routeHistoryIndex,
  user,
  onOpenDocument,
}: {
  documents: DocumentRecord[];
  routeHistoryIndex: Record<string, string>;
  user: SessionUser;
  onOpenDocument: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [useAI, setUseAI] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      source: "live-data",
      text: `Hi ${user.displayName.split(" ")[0] || "there"}. I am the RouteTrack Assistant. I can answer questions using the documents currently visible to your account.`,
    },
  ]);
  const inputRef = useRef<HTMLInputElement>(null);

  const documentMap = useMemo(
    () => new Map(documents.map((item) => [item.id, item])),
    [documents],
  );

  async function sendQuestion(rawQuestion: string) {
    const question = rawQuestion.trim();
    if (!question || loading) return;

    const userMessage: AssistantMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: question,
    };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setLoading(true);

    const local = localAnswer(question, documents, routeHistoryIndex);

    try {
      if (useAI && auth?.currentUser && !user.isDemo) {
        const idToken = await auth.currentUser.getIdToken();
        const response = await fetch("/api/ai-assistant", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            question,
            user: {
              displayName: user.displayName,
              role: user.role,
              department: user.department,
            },
            documents: compactDocuments(documents, routeHistoryIndex),
          }),
        });

        const payload = await response.json().catch(() => ({})) as {
          answer?: string;
          code?: string;
          error?: string;
        };

        if (response.ok && payload.answer) {
          const aiAnswer = payload.answer;
          setMessages((current) => [...current, {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            source: "ai",
            text: aiAnswer,
            documentIds: local.documentIds,
          }]);
          return;
        }

        if (payload.code === "AI_NOT_CONFIGURED") {
          setUseAI(false);
          setMessages((current) => [...current, {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            source: "live-data",
            text: `${local.text}\n\nAI reasoning is not configured yet. The administrator can add OPENAI_API_KEY in Vercel to enable it.`,
            documentIds: local.documentIds,
          }]);
          return;
        }

        throw new Error(payload.error || "AI request failed.");
      }

      setMessages((current) => [...current, {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        source: "live-data",
        text: local.text,
        documentIds: local.documentIds,
      }]);
    } catch {
      setMessages((current) => [...current, {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        source: "live-data",
        text: `${local.text}\n\nThe AI service could not be reached, so I used the exact RouteTrack data instead.`,
        documentIds: local.documentIds,
      }]);
    } finally {
      setLoading(false);
      window.setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void sendQuestion(input);
  }

  return (
    <>
      <button
        className={`ai-assistant-launcher ${open ? "assistant-open" : ""}`}
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? "Close RouteTrack Assistant" : "Open RouteTrack Assistant"}
      >
        {open ? <ChevronDown size={22} /> : <Bot size={23} />}
        {!open && <span>Ask RouteTrack</span>}
      </button>

      {open && (
        <section className="ai-assistant-panel" aria-label="RouteTrack Assistant">
          <header className="ai-assistant-header">
            <div className="ai-assistant-avatar"><Sparkles size={20} /></div>
            <div>
              <strong>RouteTrack Assistant</strong>
              <span>Read-only document intelligence</span>
            </div>
            <button className="icon-button" onClick={() => setOpen(false)} aria-label="Close assistant">
              <X size={18} />
            </button>
          </header>

          <div className="ai-mode-row">
            <div>
              <strong>AI reasoning</strong>
              <span>{useAI ? "Uses the secure server API" : "Exact local data answers"}</span>
            </div>
            <button
              type="button"
              className={`ai-toggle ${useAI ? "enabled" : ""}`}
              onClick={() => setUseAI((current) => !current)}
              aria-pressed={useAI}
            >
              <span />
            </button>
          </div>

          <div className="ai-quick-prompts">
            {QUICK_PROMPTS.map((prompt) => (
              <button key={prompt} onClick={() => void sendQuestion(prompt)} disabled={loading}>
                {prompt}
              </button>
            ))}
          </div>

          <div className="ai-assistant-messages">
            {messages.map((message) => (
              <article key={message.id} className={`ai-message ai-message-${message.role}`}>
                <div className="ai-message-content">
                  <p>{message.text}</p>
                  {message.role === "assistant" && message.source && (
                    <small>{message.source === "ai" ? "AI analysis" : "Live RouteTrack data"}</small>
                  )}
                </div>
                {message.documentIds && message.documentIds.length > 0 && (
                  <div className="ai-document-links">
                    {message.documentIds.map((id) => {
                      const document = documentMap.get(id);
                      if (!document) return null;
                      return (
                        <button key={id} onClick={() => onOpenDocument(id)}>
                          <FileSearch size={14} /> {document.type} {document.requestNo}
                        </button>
                      );
                    })}
                  </div>
                )}
              </article>
            ))}
            {loading && (
              <article className="ai-message ai-message-assistant">
                <div className="ai-message-content ai-thinking"><Loader2 size={16} /> Analyzing the visible records…</div>
              </article>
            )}
          </div>

          <form className="ai-assistant-composer" onSubmit={submit}>
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              maxLength={500}
              placeholder="Ask about a document, person, status, or trend…"
            />
            <button type="submit" className="primary-button" disabled={loading || !input.trim()} aria-label="Send question">
              <Send size={18} />
            </button>
          </form>

          <p className="ai-assistant-disclaimer">
            The assistant is read-only. Always record official routing, receipt, return, and completion actions in the document timeline.
          </p>
        </section>
      )}
    </>
  );
}
