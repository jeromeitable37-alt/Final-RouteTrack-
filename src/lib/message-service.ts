import {
  collection,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { db, firebaseConfigured } from "./firebase";
import {
  ConversationRecord,
  DirectMessageRecord,
  SessionUser,
  UserProfile,
} from "./types";

const LOCAL_CONVERSATIONS_KEY = "routetrack-conversations:v1";
const localMessagesKey = (conversationId: string) =>
  `routetrack-messages:v1:${conversationId}`;
const localEvent = "routetrack-local-change";

function loadLocal<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(key) || "[]") as T[];
  } catch {
    return [];
  }
}

function saveLocal<T>(key: string, value: T[]): void {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(localEvent, { detail: key }));
}

export function conversationIdFor(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join("__");
}

function normalizeConversation(
  id: string,
  value: Partial<ConversationRecord>,
): ConversationRecord {
  const now = new Date().toISOString();
  return {
    id,
    participantUids: Array.isArray(value.participantUids)
      ? value.participantUids.map(String)
      : [],
    participantNames: value.participantNames || {},
    participantEmails: value.participantEmails || {},
    unreadCounts: value.unreadCounts || {},
    lastMessage: String(value.lastMessage || ""),
    lastSenderUid: String(value.lastSenderUid || ""),
    createdAt: String(value.createdAt || now),
    updatedAt: String(value.updatedAt || value.createdAt || now),
  };
}

function normalizeMessage(
  id: string,
  conversationId: string,
  value: Partial<DirectMessageRecord>,
): DirectMessageRecord {
  return {
    id,
    conversationId,
    senderUid: String(value.senderUid || ""),
    senderName: String(value.senderName || "Unknown user"),
    recipientUid: String(value.recipientUid || ""),
    text: String(value.text || ""),
    createdAt: String(value.createdAt || new Date().toISOString()),
    readAt: String(value.readAt || ""),
  };
}

function sortConversations(items: ConversationRecord[]): ConversationRecord[] {
  return [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function sortMessages(items: DirectMessageRecord[]): DirectMessageRecord[] {
  return [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function subscribeConversations(
  userUid: string,
  callback: (items: ConversationRecord[]) => void,
): () => void {
  if (firebaseConfigured && db) {
    const conversationsQuery = query(
      collection(db, "conversations"),
      where("participantUids", "array-contains", userUid),
    );

    return onSnapshot(
      conversationsQuery,
      (snapshot) => {
        callback(
          sortConversations(
            snapshot.docs.map((item) =>
              normalizeConversation(item.id, item.data()),
            ),
          ),
        );
      },
      () => callback([]),
    );
  }

  const emit = () => {
    callback(
      sortConversations(
        loadLocal<ConversationRecord>(LOCAL_CONVERSATIONS_KEY).filter((item) =>
          item.participantUids.includes(userUid),
        ),
      ),
    );
  };

  const listener = (event: Event) => {
    const custom = event as CustomEvent<string>;
    if (custom.detail === LOCAL_CONVERSATIONS_KEY) emit();
  };

  emit();
  window.addEventListener(localEvent, listener);
  return () => window.removeEventListener(localEvent, listener);
}

export function subscribeUnreadMessageCount(
  userUid: string,
  callback: (count: number) => void,
): () => void {
  return subscribeConversations(userUid, (items) => {
    callback(
      items.reduce(
        (total, item) => total + Number(item.unreadCounts?.[userUid] || 0),
        0,
      ),
    );
  });
}

export function subscribeConversationMessages(
  conversationId: string,
  callback: (items: DirectMessageRecord[]) => void,
): () => void {
  if (!conversationId) {
    callback([]);
    return () => undefined;
  }

  if (firebaseConfigured && db) {
    const messagesQuery = query(
      collection(db, "conversations", conversationId, "messages"),
      orderBy("createdAt", "asc"),
    );

    return onSnapshot(
      messagesQuery,
      (snapshot) => {
        callback(
          sortMessages(
            snapshot.docs.map((item) =>
              normalizeMessage(item.id, conversationId, item.data()),
            ),
          ),
        );
      },
      () => callback([]),
    );
  }

  const key = localMessagesKey(conversationId);
  const emit = () =>
    callback(sortMessages(loadLocal<DirectMessageRecord>(key)));
  const listener = (event: Event) => {
    const custom = event as CustomEvent<string>;
    if (custom.detail === key) emit();
  };

  emit();
  window.addEventListener(localEvent, listener);
  return () => window.removeEventListener(localEvent, listener);
}

export async function sendDirectMessage(
  sender: SessionUser,
  recipient: UserProfile,
  rawText: string,
): Promise<void> {
  const text = rawText.trim();
  if (!text) throw new Error("Enter a message before sending.");
  if (text.length > 3000)
    throw new Error("Messages can contain up to 3,000 characters.");
  if (!recipient.active) throw new Error("That user account is disabled.");
  if (sender.uid === recipient.uid)
    throw new Error("Select another user to send a message.");

  const conversationId = conversationIdFor(sender.uid, recipient.uid);
  const now = new Date().toISOString();
  const participantUids = [sender.uid, recipient.uid].sort();
  const participantNames: Record<string, string> = {
    [sender.uid]: sender.displayName || sender.email,
    [recipient.uid]: recipient.displayName || recipient.email,
  };
  const participantEmails: Record<string, string> = {
    [sender.uid]: sender.email,
    [recipient.uid]: recipient.email,
  };

  if (firebaseConfigured && db) {
    const firestore = db;
    const conversationRef = doc(
      firestore,
      "conversations",
      conversationId,
    );
    const messageRef = doc(collection(conversationRef, "messages"));
    const batch = writeBatch(firestore);

    // Use one atomic batch and merge the conversation record. This avoids
    // reading a conversation before it exists, which security rules reject.
    batch.set(
      conversationRef,
      {
        participantUids,
        participantNames,
        participantEmails,
        unreadCounts: {
          [recipient.uid]: increment(1),
        },
        lastMessage: text,
        lastSenderUid: sender.uid,
        updatedAt: now,
      },
      { merge: true },
    );

    batch.set(messageRef, {
      conversationId,
      senderUid: sender.uid,
      senderName: sender.displayName || sender.email,
      recipientUid: recipient.uid,
      text,
      createdAt: now,
      readAt: "",
    });

    await batch.commit();
    return;
  }

  const conversations = loadLocal<ConversationRecord>(LOCAL_CONVERSATIONS_KEY);
  const existingIndex = conversations.findIndex(
    (item) => item.id === conversationId,
  );
  const previous = existingIndex >= 0 ? conversations[existingIndex] : null;
  const conversation: ConversationRecord = {
    id: conversationId,
    participantUids,
    participantNames,
    participantEmails,
    unreadCounts: {
      ...(previous?.unreadCounts || {}),
      [sender.uid]: Number(previous?.unreadCounts?.[sender.uid] || 0),
      [recipient.uid]: Number(previous?.unreadCounts?.[recipient.uid] || 0) + 1,
    },
    lastMessage: text,
    lastSenderUid: sender.uid,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
  };

  if (existingIndex >= 0) conversations[existingIndex] = conversation;
  else conversations.push(conversation);
  saveLocal(LOCAL_CONVERSATIONS_KEY, conversations);

  const messageKey = localMessagesKey(conversationId);
  const messages = loadLocal<DirectMessageRecord>(messageKey);
  messages.push({
    id: crypto.randomUUID(),
    conversationId,
    senderUid: sender.uid,
    senderName: sender.displayName || sender.email,
    recipientUid: recipient.uid,
    text,
    createdAt: now,
    readAt: "",
  });
  saveLocal(messageKey, messages);
}

export async function markConversationRead(
  conversationId: string,
  userUid: string,
  messages: DirectMessageRecord[],
): Promise<void> {
  if (!conversationId) return;
  const unread = messages.filter(
    (item) => item.recipientUid === userUid && !item.readAt,
  );

  if (firebaseConfigured && db) {
    // Store the narrowed Firestore instance in a local constant.
    // TypeScript does not always preserve `db !== null` inside callbacks.
    const firestore = db;

    const conversationRef = doc(
      firestore,
      "conversations",
      conversationId,
    );

    const batch = writeBatch(firestore);

    batch.update(conversationRef, {
      [`unreadCounts.${userUid}`]: 0,
    });

    const readAt = new Date().toISOString();

    unread.forEach((item) => {
      const messageRef = doc(
        firestore,
        "conversations",
        conversationId,
        "messages",
        item.id,
      );

      batch.update(messageRef, { readAt });
    });

    await batch.commit();
    return;
  }

  const conversations = loadLocal<ConversationRecord>(LOCAL_CONVERSATIONS_KEY).map(
    (item) =>
      item.id === conversationId
        ? {
            ...item,
            unreadCounts: {
              ...item.unreadCounts,
              [userUid]: 0,
            },
          }
        : item,
  );
  saveLocal(LOCAL_CONVERSATIONS_KEY, conversations);

  if (unread.length) {
    const key = localMessagesKey(conversationId);
    const readAt = new Date().toISOString();
    saveLocal(
      key,
      loadLocal<DirectMessageRecord>(key).map((item) =>
        item.recipientUid === userUid && !item.readAt
          ? { ...item, readAt }
          : item,
      ),
    );
  }
}