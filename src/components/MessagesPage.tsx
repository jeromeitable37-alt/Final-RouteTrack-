"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CheckCheck,
  MessageCircle,
  Search,
  Send,
  Users,
} from "lucide-react";
import {
  markConversationRead,
  sendDirectMessage,
  subscribeConversationMessages,
  subscribeConversations,
} from "@/lib/message-service";
import {
  ConversationRecord,
  DirectMessageRecord,
  SessionUser,
  UserProfile,
} from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { sendPushNotification } from "@/lib/push-notifications";
import { Avatar } from "./Avatar";

export function MessagesPage({
  user,
  users,
  notify,
  initialContactUid = "",
}: {
  user: SessionUser;
  users: UserProfile[];
  notify: (message: string, error?: boolean) => void;
  initialContactUid?: string;
}) {
  const [conversations, setConversations] = useState<ConversationRecord[]>([]);
  const [selectedUid, setSelectedUid] = useState("");
  const [messages, setMessages] = useState<DirectMessageRecord[]>([]);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const contacts = useMemo(
    () =>
      users
        .filter((item) => item.uid !== user.uid && item.active)
        .sort((a, b) => {
          if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
          return a.displayName.localeCompare(b.displayName);
        }),
    [user.uid, users],
  );

  const filteredContacts = contacts.filter((item) =>
    `${item.displayName} ${item.email} ${item.department} ${item.position || ""}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );

  const selectedContact = contacts.find((item) => item.uid === selectedUid) || null;
  const selectedConversation = selectedUid
    ? conversations.find((item) => item.participantUids.includes(selectedUid)) || null
    : null;

  useEffect(() => {
    if (initialContactUid && contacts.some((item) => item.uid === initialContactUid)) {
      setSelectedUid(initialContactUid);
    }
  }, [contacts, initialContactUid]);

  useEffect(
    () => subscribeConversations(user.uid, setConversations),
    [user.uid],
  );

  useEffect(() => {
    if (selectedUid || !contacts.length) return;

    const recentContactUid = conversations
      .flatMap((item) => item.participantUids)
      .find((uid) => uid !== user.uid && contacts.some((item) => item.uid === uid));

    const admin = contacts.find((item) => item.role === "admin");
    setSelectedUid(recentContactUid || admin?.uid || contacts[0].uid);
  }, [contacts, conversations, selectedUid, user.uid]);

  useEffect(() => {
    if (!selectedConversation) {
      setMessages([]);
      return;
    }

    return subscribeConversationMessages(selectedConversation.id, setMessages);
  }, [selectedConversation?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!selectedConversation || !messages.length) return;
    const hasUnread = messages.some(
      (item) => item.recipientUid === user.uid && !item.readAt,
    );
    if (!hasUnread && Number(selectedConversation.unreadCounts?.[user.uid] || 0) === 0)
      return;

    void markConversationRead(selectedConversation.id, user.uid, messages).catch(
      () => undefined,
    );
  }, [messages, selectedConversation, user.uid]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selectedContact || !draft.trim()) return;

    setSending(true);
    try {
      const messageText = draft.trim();
      await sendDirectMessage(user, selectedContact, messageText);
      setDraft("");
      void sendPushNotification({
        recipientUid: selectedContact.uid,
        title: `New message from ${user.displayName || user.email}`,
        body: messageText.length > 150 ? `${messageText.slice(0, 147)}…` : messageText,
        url: `/?view=messages&contact=${encodeURIComponent(user.uid)}`,
        category: "message",
      }).catch(() => undefined);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Unable to send the message.",
        true,
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="messages-page">
      <section className="message-directory panel">
        <div className="message-directory-heading">
          <div>
            <p className="eyebrow">PURCHASING TEAM</p>
            <h2>Messages</h2>
          </div>
          <Users size={20} />
        </div>

        <div className="search-box message-search">
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search admin or staff…"
          />
        </div>

        <div className="message-contact-list">
          {filteredContacts.length ? (
            filteredContacts.map((contact) => {
              const conversation = conversations.find((item) =>
                item.participantUids.includes(contact.uid),
              );
              const unread = Number(conversation?.unreadCounts?.[user.uid] || 0);

              return (
                <button
                  key={contact.uid}
                  type="button"
                  className={selectedUid === contact.uid ? "active" : ""}
                  onClick={() => setSelectedUid(contact.uid)}
                >
                  <Avatar
                    name={contact.displayName}
                    photoDataUrl={contact.photoDataUrl}
                    size="small"
                  />
                  <span className="message-contact-copy">
                    <strong>
                      {contact.displayName}
                      {contact.role === "admin" ? " · Admin" : ""}
                    </strong>
                    <small>
                      {conversation?.lastMessage ||
                        contact.position ||
                        contact.department ||
                        contact.email}
                    </small>
                  </span>
                  {unread > 0 && <span className="message-unread-badge">{unread}</span>}
                </button>
              );
            })
          ) : (
            <div className="empty-panel message-empty-contact">
              No other active account is available.
            </div>
          )}
        </div>
      </section>

      <section className="message-chat panel">
        {selectedContact ? (
          <>
            <header className="message-chat-header">
              <Avatar
                name={selectedContact.displayName}
                photoDataUrl={selectedContact.photoDataUrl}
              />
              <div>
                <strong>{selectedContact.displayName}</strong>
                <span>
                  {selectedContact.role === "admin"
                    ? "Administrator"
                    : selectedContact.position ||
                      selectedContact.department ||
                      "Purchasing staff"}
                </span>
              </div>
            </header>

            <div className="message-thread" aria-live="polite">
              {messages.length ? (
                messages.map((message) => {
                  const mine = message.senderUid === user.uid;
                  return (
                    <article
                      key={message.id}
                      className={`message-bubble-row ${mine ? "message-mine" : "message-theirs"}`}
                    >
                      <div className="message-bubble">
                        <p>{message.text}</p>
                        <span>
                          {formatDateTime(message.createdAt)}
                          {mine && message.readAt ? (
                            <CheckCheck size={14} aria-label="Read" />
                          ) : null}
                        </span>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="message-thread-empty">
                  <MessageCircle size={34} />
                  <strong>Start a conversation</strong>
                  <span>
                    Send routing updates, follow-up notes, or questions about a
                    document.
                  </span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form className="message-composer" onSubmit={submit}>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Write a message…"
                maxLength={3000}
                rows={2}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <button
                className="primary-button"
                type="submit"
                disabled={sending || !draft.trim()}
              >
                <Send size={17} />
                {sending ? "Sending…" : "Send"}
              </button>
            </form>
          </>
        ) : (
          <div className="message-thread-empty message-no-selection">
            <MessageCircle size={38} />
            <strong>Select a person</strong>
            <span>Choose an administrator or Student Assistant to communicate.</span>
          </div>
        )}
      </section>
    </div>
  );
}
