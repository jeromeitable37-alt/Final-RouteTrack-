import { deleteApp, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  inMemoryPersistence,
  setPersistence,
  signOut,
  updateProfile,
  User as FirebaseUser,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { firebaseConfig, db, firebaseConfigured } from "./firebase";
import {
  ActivityRecord,
  DocumentInput,
  DocumentRecord,
  ManagedUserInput,
  RoutingInput,
  RoutingRecord,
  SessionUser,
  UserProfile,
} from "./types";
import { trackingId } from "./utils";
import { isBootstrapAdminEmail } from "./admin-config";

const GLOBAL_DOCS_KEY = "routetrack-documents:global-v4";
const GLOBAL_USERS_KEY = "routetrack-users:global-v4";
const GLOBAL_ACTIVITY_KEY = "routetrack-activity:global-v5";
const routesKey = (documentId: string) => `routetrack-routes:v4:${documentId}`;
const legacyDocsKey = (uid: string) => `prf-srf-documents:${uid}`;
const legacyRoutesKey = (uid: string, documentId: string) =>
  `prf-srf-routes:${uid}:${documentId}`;
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

function normalizeUserProfile(profile: UserProfile): UserProfile {
  const normalizedRole =
    String(profile.role || "staff")
      .trim()
      .toLowerCase() === "admin"
      ? "admin"
      : "staff";
  return {
    ...profile,
    email: String(profile.email || "")
      .trim()
      .toLowerCase(),
    displayName: String(profile.displayName || profile.email || "User").trim(),
    department: String(profile.department || "").trim(),
    position: String(profile.position || "").trim(),
    phone: String(profile.phone || "").trim(),
    photoDataUrl: String(profile.photoDataUrl || ""),
    role: normalizedRole,
    active: profile.active !== false,
  };
}

function normalizeDocument(
  raw: Partial<DocumentRecord> & { id: string },
): DocumentRecord {
  const now = new Date().toISOString();
  return {
    id: raw.id,
    trackingId: String(raw.trackingId || raw.requestNo || "DOCUMENT"),
    ownerUid: String(raw.ownerUid || ""),
    ownerName: String(raw.ownerName || "Unknown user"),
    ownerEmail: String(raw.ownerEmail || ""),
    type: (["PRF", "SRF", "CRF", "PO"] as const).includes(raw.type as never)
      ? (raw.type as DocumentRecord["type"])
      : "PRF",
    requestNo: String(raw.requestNo || ""),
    dateRequested: String(
      raw.dateRequested || raw.dateLogged || now.slice(0, 10),
    ),
    requestingDepartment: String(raw.requestingDepartment || ""),
    requestor: String(raw.requestor || raw.purchasingEmployee || ""),
    subjectPurpose: String(raw.subjectPurpose || raw.itemsDescription || ""),
    amount: Number(raw.amount || 0),
    dateLogged: String(raw.dateLogged || raw.dateRequested || now.slice(0, 10)),
    currentHolder: String(
      raw.currentHolder || raw.lastToOffice || "Student Assistant / Records",
    ),
    status: raw.status || "For Routing",
    dueDate: String(raw.dueDate || ""),
    copyType: raw.copyType || "Original",
    physicalLocation: String(raw.physicalLocation || ""),
    remarks: String(raw.remarks || ""),
    routeCount: Number(raw.routeCount || 0),
    createdAt: String(raw.createdAt || now),
    updatedAt: String(raw.updatedAt || raw.createdAt || now),
    organization: String(raw.organization || ""),
    supplier: String(raw.supplier || ""),
    purchasingEmployee: String(raw.purchasingEmployee || raw.requestor || ""),
    dateForwardedSupplier: String(raw.dateForwardedSupplier || ""),
    paymentTerms: String(raw.paymentTerms || ""),
    itemsDescription: String(raw.itemsDescription || raw.subjectPurpose || ""),
    lastRoutedAt: raw.lastRoutedAt,
    lastFromOffice: raw.lastFromOffice,
    lastToOffice: raw.lastToOffice,
    lastRoutePurpose: raw.lastRoutePurpose,
    lastReceivedBy: raw.lastReceivedBy,
    lastReceivedAt: raw.lastReceivedAt,
    lastMovementStatus: raw.lastMovementStatus,
    lastRouteEncodedBy: raw.lastRouteEncodedBy,
    lastProofReference: raw.lastProofReference,
    routeSearchText: String(raw.routeSearchText || ""),
    completedAt: raw.completedAt,
    archivedAt: raw.archivedAt,
    archivedBy: raw.archivedBy,
  };
}

function sortDocuments(items: DocumentRecord[]): DocumentRecord[] {
  return [...items]
    .map((item) => normalizeDocument(item))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function sortUsers(items: UserProfile[]): UserProfile[] {
  return [...items]
    .map(normalizeUserProfile)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function seedDemoUsers(): UserProfile[] {
  const current = loadLocal<UserProfile>(GLOBAL_USERS_KEY);
  if (current.length) return current;
  const now = new Date().toISOString();
  const seeded: UserProfile[] = [
    {
      uid: "demo-admin",
      email: "admin@demo.local",
      displayName: "Demo Administrator",
      department: "Student Assistant / Records",
      position: "System Administrator",
      phone: "",
      photoDataUrl: "",
      role: "admin",
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      uid: "demo-staff",
      email: "staff@demo.local",
      displayName: "Demo Staff",
      department: "Purchasing",
      position: "Staff",
      phone: "",
      photoDataUrl: "",
      role: "staff",
      active: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
  saveLocal(GLOBAL_USERS_KEY, seeded);
  return seeded;
}

export async function ensureUserProfile(
  firebaseUser: FirebaseUser,
): Promise<UserProfile> {
  if (!firebaseConfigured || !db)
    throw new Error("Firebase is not configured.");

  const ref = doc(db, "users", firebaseUser.uid);
  const snapshot = await getDoc(ref);
  if (snapshot.exists()) {
    let profile = normalizeUserProfile(snapshot.data() as UserProfile);
    if (
      isBootstrapAdminEmail(firebaseUser.email || profile.email) &&
      profile.role !== "admin"
    ) {
      profile = {
        ...profile,
        role: "admin",
        active: true,
        updatedAt: new Date().toISOString(),
      };
      await setDoc(ref, profile, { merge: true });
    }
    return profile;
  }

  const now = new Date().toISOString();
  const email = firebaseUser.email || "";
  const profile: UserProfile = {
    uid: firebaseUser.uid,
    email,
    displayName: firebaseUser.displayName || email.split("@")[0] || "User",
    department: "",
    position: "",
    phone: "",
    photoDataUrl: "",
    role: isBootstrapAdminEmail(email) ? "admin" : "staff",
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(ref, profile);
  return profile;
}

export function subscribeUserProfile(
  uid: string,
  callback: (profile: UserProfile | null) => void,
): () => void {
  if (firebaseConfigured && db) {
    return onSnapshot(
      doc(db, "users", uid),
      (snapshot) => {
        callback(
          snapshot.exists()
            ? normalizeUserProfile(snapshot.data() as UserProfile)
            : null,
        );
      },
      () => callback(null),
    );
  }
  seedDemoUsers();
  const emit = () =>
    callback(
      loadLocal<UserProfile>(GLOBAL_USERS_KEY).find(
        (item) => item.uid === uid,
      ) || null,
    );
  const listener = (event: Event) => {
    const custom = event as CustomEvent<string>;
    if (custom.detail === GLOBAL_USERS_KEY) emit();
  };
  emit();
  window.addEventListener(localEvent, listener);
  return () => window.removeEventListener(localEvent, listener);
}

export function subscribeUsers(
  callback: (items: UserProfile[]) => void,
): () => void {
  if (firebaseConfigured && db) {
    return onSnapshot(collection(db, "users"), (snapshot) => {
      callback(
        sortUsers(snapshot.docs.map((item) => item.data() as UserProfile)),
      );
    });
  }
  seedDemoUsers();
  const emit = () =>
    callback(sortUsers(loadLocal<UserProfile>(GLOBAL_USERS_KEY)));
  const listener = (event: Event) => {
    const custom = event as CustomEvent<string>;
    if (custom.detail === GLOBAL_USERS_KEY) emit();
  };
  emit();
  window.addEventListener(localEvent, listener);
  return () => window.removeEventListener(localEvent, listener);
}

export async function createManagedUser(
  input: ManagedUserInput,
): Promise<UserProfile> {
  const now = new Date().toISOString();
  if (firebaseConfigured && db) {
    if (!input.password || input.password.length < 6)
      throw new Error("Temporary password must contain at least 6 characters.");
    const secondaryApp = initializeApp(
      firebaseConfig,
      `managed-user-${Date.now()}`,
    );
    const secondaryAuth = getAuth(secondaryApp);
    let createdUser: FirebaseUser | null = null;
    try {
      await setPersistence(secondaryAuth, inMemoryPersistence);
      const credential = await createUserWithEmailAndPassword(
        secondaryAuth,
        input.email.trim(),
        input.password,
      );
      createdUser = credential.user;
      await updateProfile(createdUser, {
        displayName: input.displayName.trim(),
      });
      const profile: UserProfile = {
        uid: createdUser.uid,
        email: input.email.trim().toLowerCase(),
        displayName: input.displayName.trim(),
        department: input.department.trim(),
        position: String(input.position || "").trim(),
        phone: String(input.phone || "").trim(),
        photoDataUrl: String(input.photoDataUrl || ""),
        role: input.role,
        active: input.active,
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(doc(db, "users", createdUser.uid), profile);
      return profile;
    } catch (error) {
      if (createdUser) {
        try {
          await deleteUser(createdUser);
        } catch {
          /* manual cleanup may be needed */
        }
      }
      throw error;
    } finally {
      try {
        await signOut(secondaryAuth);
      } catch {
        /* no-op */
      }
      await deleteApp(secondaryApp);
    }
  }

  const profile: UserProfile = {
    uid: crypto.randomUUID(),
    email: input.email.trim().toLowerCase(),
    displayName: input.displayName.trim(),
    department: input.department.trim(),
    position: String(input.position || "").trim(),
    phone: String(input.phone || "").trim(),
    photoDataUrl: String(input.photoDataUrl || ""),
    role: input.role,
    active: input.active,
    createdAt: now,
    updatedAt: now,
  };
  const users = seedDemoUsers();
  if (users.some((item) => item.email === profile.email))
    throw new Error("That email address already exists.");
  saveLocal(GLOBAL_USERS_KEY, [...users, profile]);
  return profile;
}

export async function updateManagedUser(
  uid: string,
  changes: Partial<UserProfile>,
): Promise<void> {
  const payload = { ...changes, uid, updatedAt: new Date().toISOString() };
  if (firebaseConfigured && db) {
    await setDoc(doc(db, "users", uid), payload, { merge: true });
    return;
  }
  const users = seedDemoUsers().map((item) =>
    item.uid === uid ? { ...item, ...payload } : item,
  );
  saveLocal(GLOBAL_USERS_KEY, users);
}

function migrateLocalLegacyDocuments(owner: UserProfile): void {
  const legacy = loadLocal<
    Omit<DocumentRecord, "ownerUid" | "ownerName" | "ownerEmail">
  >(legacyDocsKey(owner.uid));
  if (!legacy.length) return;
  const global = loadLocal<DocumentRecord>(GLOBAL_DOCS_KEY);
  const knownIds = new Set(global.map((item) => item.id));
  const migrated = legacy
    .filter((item) => !knownIds.has(item.id))
    .map((item) => ({
      ...item,
      ownerUid: owner.uid,
      ownerName: owner.displayName,
      ownerEmail: owner.email,
    }));
  if (migrated.length)
    saveLocal(GLOBAL_DOCS_KEY, [...global, ...migrated] as DocumentRecord[]);
}

export async function migrateLegacyDocuments(
  owner: UserProfile,
): Promise<void> {
  if (!firebaseConfigured || !db) {
    migrateLocalLegacyDocuments(owner);
    return;
  }
  const legacyRef = collection(db, "users", owner.uid, "documents");
  const legacySnapshot = await getDocs(legacyRef);
  for (const legacyDocument of legacySnapshot.docs) {
    const destination = doc(db, "documents", legacyDocument.id);
    const current = await getDoc(destination);
    if (!current.exists()) {
      await setDoc(destination, {
        ...legacyDocument.data(),
        ownerUid: owner.uid,
        ownerName: owner.displayName,
        ownerEmail: owner.email,
      });
    }
    const legacyRoutes = await getDocs(
      collection(
        db,
        "users",
        owner.uid,
        "documents",
        legacyDocument.id,
        "routes",
      ),
    );
    for (const legacyRoute of legacyRoutes.docs) {
      const destinationRoute = doc(
        db,
        "documents",
        legacyDocument.id,
        "routes",
        legacyRoute.id,
      );
      const existingRoute = await getDoc(destinationRoute);
      if (!existingRoute.exists()) {
        await setDoc(destinationRoute, {
          ...legacyRoute.data(),
          createdByUid: owner.uid,
          createdByName: owner.displayName,
        });
      }
    }
  }
}

export function subscribeDocuments(
  uid: string,
  callback: (items: DocumentRecord[]) => void,
): () => void {
  if (firebaseConfigured && db) {
    const q = query(collection(db, "documents"), where("ownerUid", "==", uid));
    return onSnapshot(q, (snapshot) => {
      callback(
        sortDocuments(
          snapshot.docs.map((item) =>
            normalizeDocument({ id: item.id, ...item.data() }),
          ),
        ),
      );
    });
  }
  const emit = () =>
    callback(
      sortDocuments(
        loadLocal<DocumentRecord>(GLOBAL_DOCS_KEY).filter(
          (item) => item.ownerUid === uid,
        ),
      ),
    );
  const listener = (event: Event) => {
    const custom = event as CustomEvent<string>;
    if (custom.detail === GLOBAL_DOCS_KEY) emit();
  };
  emit();
  window.addEventListener(localEvent, listener);
  return () => window.removeEventListener(localEvent, listener);
}

export function subscribeAllDocuments(
  callback: (items: DocumentRecord[]) => void,
): () => void {
  if (firebaseConfigured && db) {
    return onSnapshot(collection(db, "documents"), (snapshot) => {
      callback(
        sortDocuments(
          snapshot.docs.map((item) =>
            normalizeDocument({ id: item.id, ...item.data() }),
          ),
        ),
      );
    });
  }
  const emit = () =>
    callback(sortDocuments(loadLocal<DocumentRecord>(GLOBAL_DOCS_KEY)));
  const listener = (event: Event) => {
    const custom = event as CustomEvent<string>;
    if (custom.detail === GLOBAL_DOCS_KEY) emit();
  };
  emit();
  window.addEventListener(localEvent, listener);
  return () => window.removeEventListener(localEvent, listener);
}

export async function addDocument(
  owner: Pick<UserProfile, "uid" | "displayName" | "email">,
  input: DocumentInput,
): Promise<string> {
  const now = new Date().toISOString();
  const payload = {
    ...input,
    ownerUid: owner.uid,
    ownerName: owner.displayName,
    ownerEmail: owner.email,
    trackingId: trackingId(input.type),
    routeCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  if (firebaseConfigured && db) {
    const ref = doc(collection(db, "documents"));
    await setDoc(ref, payload);
    return ref.id;
  }
  const id = crypto.randomUUID();
  const documents = loadLocal<DocumentRecord>(GLOBAL_DOCS_KEY);
  documents.unshift(normalizeDocument({ id, ...payload }));
  saveLocal(GLOBAL_DOCS_KEY, documents);
  return id;
}

export async function updateDocument(
  id: string,
  changes: Partial<DocumentRecord>,
): Promise<void> {
  const {
    ownerUid: _ownerUid,
    ownerName: _ownerName,
    ownerEmail: _ownerEmail,
    ...safeChanges
  } = changes;
  const payload = { ...safeChanges, updatedAt: new Date().toISOString() };
  if (firebaseConfigured && db) {
    await updateDoc(doc(db, "documents", id), payload);
    return;
  }
  const documents = loadLocal<DocumentRecord>(GLOBAL_DOCS_KEY).map((item) =>
    item.id === id ? normalizeDocument({ ...item, ...payload, id }) : item,
  );
  saveLocal(GLOBAL_DOCS_KEY, documents);
}

export async function removeDocument(id: string): Promise<void> {
  if (firebaseConfigured && db) {
    const routeSnapshot = await getDocs(
      collection(db, "documents", id, "routes"),
    );
    await Promise.all(routeSnapshot.docs.map((item) => deleteDoc(item.ref)));
    await deleteDoc(doc(db, "documents", id));
    return;
  }
  saveLocal(
    GLOBAL_DOCS_KEY,
    loadLocal<DocumentRecord>(GLOBAL_DOCS_KEY).filter((item) => item.id !== id),
  );
  localStorage.removeItem(routesKey(id));
}

export function subscribeRoutes(
  documentId: string,
  callback: (items: RoutingRecord[]) => void,
): () => void {
  if (firebaseConfigured && db) {
    return onSnapshot(
      collection(db, "documents", documentId, "routes"),
      (snapshot) => {
        const items = snapshot.docs.map(
          (item) => ({ id: item.id, ...item.data() }) as RoutingRecord,
        );
        callback(
          items.sort((a, b) =>
            b.dateTimeRouted.localeCompare(a.dateTimeRouted),
          ),
        );
      },
    );
  }
  const key = routesKey(documentId);
  const emit = () =>
    callback(
      loadLocal<RoutingRecord>(key).sort((a, b) =>
        b.dateTimeRouted.localeCompare(a.dateTimeRouted),
      ),
    );
  const listener = (event: Event) => {
    const custom = event as CustomEvent<string>;
    if (custom.detail === key) emit();
  };
  emit();
  window.addEventListener(localEvent, listener);
  return () => window.removeEventListener(localEvent, listener);
}

export async function getRoutes(documentId: string): Promise<RoutingRecord[]> {
  if (firebaseConfigured && db) {
    const snapshot = await getDocs(
      collection(db, "documents", documentId, "routes"),
    );
    return snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }) as RoutingRecord)
      .sort((a, b) => b.dateTimeRouted.localeCompare(a.dateTimeRouted));
  }
  return loadLocal<RoutingRecord>(routesKey(documentId)).sort((a, b) =>
    b.dateTimeRouted.localeCompare(a.dateTimeRouted),
  );
}

export async function migrateLocalLegacyRoutes(
  ownerUid: string,
  documentId: string,
): Promise<void> {
  if (firebaseConfigured) return;
  const current = loadLocal<RoutingRecord>(routesKey(documentId));
  if (current.length) return;
  const legacy = loadLocal<RoutingRecord>(
    legacyRoutesKey(ownerUid, documentId),
  );
  if (legacy.length) saveLocal(routesKey(documentId), legacy);
}

export async function addRoute(
  actor: Pick<SessionUser, "uid" | "displayName">,
  documentId: string,
  input: RoutingInput,
): Promise<void> {
  const payload = {
    ...input,
    documentId,
    createdAt: new Date().toISOString(),
    createdByUid: actor.uid,
    createdByName: actor.displayName,
  };
  if (firebaseConfigured && db) {
    await addDoc(collection(db, "documents", documentId, "routes"), payload);
    return;
  }
  const key = routesKey(documentId);
  const routes = loadLocal<RoutingRecord>(key);
  routes.unshift({ id: crypto.randomUUID(), ...payload });
  saveLocal(key, routes);
}

export async function addActivityLog(
  actor: Pick<SessionUser, "uid" | "displayName" | "email">,
  action: string,
  summary: string,
  document?: Pick<DocumentRecord, "id" | "type" | "requestNo">,
): Promise<void> {
  const payload = {
    actorUid: actor.uid,
    actorName: actor.displayName || actor.email,
    actorEmail: actor.email,
    action,
    summary,
    documentId: document?.id || "",
    documentLabel: document ? `${document.type} ${document.requestNo}` : "",
    createdAt: new Date().toISOString(),
  };
  if (firebaseConfigured && db) {
    try {
      await addDoc(collection(db, "activityLogs"), payload);
    } catch {
      // Activity logging must never block the main document action.
    }
    return;
  }
  const items = loadLocal<ActivityRecord>(GLOBAL_ACTIVITY_KEY);
  items.unshift({ id: crypto.randomUUID(), ...payload });
  saveLocal(GLOBAL_ACTIVITY_KEY, items.slice(0, 1000));
}

export function subscribeActivityLogs(
  user: Pick<SessionUser, "uid" | "role">,
  callback: (items: ActivityRecord[]) => void,
): () => void {
  const admin =
    String(user.role || "")
      .trim()
      .toLowerCase() === "admin";
  if (firebaseConfigured && db) {
    const source = admin
      ? collection(db, "activityLogs")
      : query(
          collection(db, "activityLogs"),
          where("actorUid", "==", user.uid),
        );
    return onSnapshot(
      source,
      (snapshot) => {
        const items = snapshot.docs.map(
          (item) => ({ id: item.id, ...item.data() }) as ActivityRecord,
        );
        callback(
          items
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, 500),
        );
      },
      () => callback([]),
    );
  }
  const emit = () => {
    const items = loadLocal<ActivityRecord>(GLOBAL_ACTIVITY_KEY)
      .filter((item) => admin || item.actorUid === user.uid)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    callback(items);
  };
  const listener = (event: Event) => {
    const custom = event as CustomEvent<string>;
    if (custom.detail === GLOBAL_ACTIVITY_KEY) emit();
  };
  emit();
  window.addEventListener(localEvent, listener);
  return () => window.removeEventListener(localEvent, listener);
}