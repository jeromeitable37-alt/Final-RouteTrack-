import {
  addDoc,
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db, firebaseConfigured } from "./firebase";
import {
  DocumentRecord,
  FollowUpRecord,
  HandoverRecord,
  LoginActivityRecord,
  SessionUser,
  SupportingLinkRecord,
} from "./types";
import { addActivityLog, updateDocument } from "./data-service";

const localEvent = "routetrack-local-change";
const followUpsKey = (documentId: string) => `routetrack-followups:v1:${documentId}`;
const linksKey = (documentId: string) => `routetrack-supporting-links:v1:${documentId}`;
const HANDOVERS_KEY = "routetrack-handovers:v1";
const LOGIN_ACTIVITY_KEY = "routetrack-login-activity:v1";

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

function subscribeLocal<T>(key: string, callback: (items: T[]) => void): () => void {
  const emit = () => callback(loadLocal<T>(key));
  const listener = (event: Event) => {
    const custom = event as CustomEvent<string>;
    if (custom.detail === key) emit();
  };
  emit();
  window.addEventListener(localEvent, listener);
  return () => window.removeEventListener(localEvent, listener);
}

export function subscribeFollowUps(
  documentId: string,
  callback: (items: FollowUpRecord[]) => void,
): () => void {
  if (firebaseConfigured && db) {
    return onSnapshot(
      collection(db, "documents", documentId, "followUps"),
      (snapshot) => callback(
        snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() }) as FollowUpRecord)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      ),
      () => callback([]),
    );
  }
  return subscribeLocal<FollowUpRecord>(followUpsKey(documentId), (items) =>
    callback([...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
  );
}

export async function addFollowUp(
  actor: SessionUser,
  document: DocumentRecord,
  input: Pick<FollowUpRecord, "contactedPerson" | "method" | "result" | "nextFollowUpAt" | "notes">,
): Promise<void> {
  const now = new Date().toISOString();
  const payload = {
    ...input,
    documentId: document.id,
    createdAt: now,
    createdByUid: actor.uid,
    createdByName: actor.displayName || actor.email,
  };

  if (firebaseConfigured && db) {
    await addDoc(collection(db, "documents", document.id, "followUps"), payload);
  } else {
    const key = followUpsKey(document.id);
    const items = loadLocal<FollowUpRecord>(key);
    items.unshift({ id: crypto.randomUUID(), ...payload });
    saveLocal(key, items);
  }

  await updateDocument(document.id, {
    lastFollowUpAt: now,
    nextFollowUpAt: input.nextFollowUpAt,
    followUpCount: Number(document.followUpCount || 0) + 1,
  });
  await addActivityLog(
    actor,
    "FOLLOW_UP",
    `${document.type} ${document.requestNo}: followed up with ${input.contactedPerson} via ${input.method}.`,
    document,
  );
}

export function subscribeSupportingLinks(
  documentId: string,
  callback: (items: SupportingLinkRecord[]) => void,
): () => void {
  if (firebaseConfigured && db) {
    return onSnapshot(
      collection(db, "documents", documentId, "supportingLinks"),
      (snapshot) => callback(
        snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() }) as SupportingLinkRecord)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      ),
      () => callback([]),
    );
  }
  return subscribeLocal<SupportingLinkRecord>(linksKey(documentId), (items) =>
    callback([...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
  );
}

export async function addSupportingLink(
  actor: SessionUser,
  document: DocumentRecord,
  input: Pick<SupportingLinkRecord, "title" | "url" | "notes">,
): Promise<void> {
  const payload = {
    ...input,
    documentId: document.id,
    createdAt: new Date().toISOString(),
    createdByUid: actor.uid,
    createdByName: actor.displayName || actor.email,
  };

  if (firebaseConfigured && db) {
    await addDoc(collection(db, "documents", document.id, "supportingLinks"), payload);
  } else {
    const key = linksKey(document.id);
    const items = loadLocal<SupportingLinkRecord>(key);
    items.unshift({ id: crypto.randomUUID(), ...payload });
    saveLocal(key, items);
  }

  await addActivityLog(
    actor,
    "SUPPORTING_LINK",
    `${document.type} ${document.requestNo}: supporting link “${input.title}” added.`,
    document,
  );
}

export async function addHandover(
  actor: SessionUser,
  summary: string,
  documentIds: string[],
): Promise<void> {
  const payload = {
    ownerUid: actor.uid,
    ownerName: actor.displayName || actor.email,
    shiftDate: new Date().toISOString().slice(0, 10),
    summary,
    documentIds,
    createdAt: new Date().toISOString(),
  };

  if (firebaseConfigured && db) {
    await addDoc(collection(db, "handovers"), payload);
  } else {
    const items = loadLocal<HandoverRecord>(HANDOVERS_KEY);
    items.unshift({ id: crypto.randomUUID(), ...payload });
    saveLocal(HANDOVERS_KEY, items.slice(0, 200));
  }
  await addActivityLog(actor, "SHIFT_HANDOVER", "Shift handover report saved.");
}

export function subscribeHandovers(
  user: SessionUser,
  callback: (items: HandoverRecord[]) => void,
): () => void {
  const admin = String(user.role).toLowerCase() === "admin";
  if (firebaseConfigured && db) {
    const source = admin
      ? collection(db, "handovers")
      : query(collection(db, "handovers"), where("ownerUid", "==", user.uid));
    return onSnapshot(source, (snapshot) => callback(
      snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }) as HandoverRecord)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    ), () => callback([]));
  }
  return subscribeLocal<HandoverRecord>(HANDOVERS_KEY, (items) => callback(
    items
      .filter((item) => admin || item.ownerUid === user.uid)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  ));
}

export async function recordLoginActivity(user: SessionUser): Promise<void> {
  if (user.isDemo) return;
  const payload = {
    userUid: user.uid,
    userName: user.displayName || user.email,
    userEmail: user.email,
    userAgent: typeof navigator === "undefined" ? "Unknown device" : navigator.userAgent.slice(0, 300),
    createdAt: new Date().toISOString(),
  };
  if (firebaseConfigured && db) {
    try {
      await addDoc(collection(db, "loginActivity"), payload);
    } catch {
      // Login tracking must never block the application.
    }
    return;
  }
  const items = loadLocal<LoginActivityRecord>(LOGIN_ACTIVITY_KEY);
  items.unshift({ id: crypto.randomUUID(), ...payload });
  saveLocal(LOGIN_ACTIVITY_KEY, items.slice(0, 300));
}

export function subscribeLoginActivity(
  user: SessionUser,
  callback: (items: LoginActivityRecord[]) => void,
): () => void {
  const admin = String(user.role).toLowerCase() === "admin";
  if (firebaseConfigured && db) {
    const source = admin
      ? collection(db, "loginActivity")
      : query(collection(db, "loginActivity"), where("userUid", "==", user.uid));
    return onSnapshot(source, (snapshot) => callback(
      snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }) as LoginActivityRecord)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 200),
    ), () => callback([]));
  }
  return subscribeLocal<LoginActivityRecord>(LOGIN_ACTIVITY_KEY, (items) => callback(
    items
      .filter((item) => admin || item.userUid === user.uid)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  ));
}
