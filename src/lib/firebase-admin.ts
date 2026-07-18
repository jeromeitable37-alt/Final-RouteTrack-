import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function adminApp() {
  if (getApps().length) return getApps()[0];

  return initializeApp({
    credential: cert({
      projectId: required("FIREBASE_ADMIN_PROJECT_ID"),
      clientEmail: required("FIREBASE_ADMIN_CLIENT_EMAIL"),
      privateKey: required("FIREBASE_ADMIN_PRIVATE_KEY").replace(/\\n/g, "\n"),
    }),
  });
}

export function adminAuth() {
  return getAuth(adminApp());
}

export function adminDb() {
  return getFirestore(adminApp());
}

export function adminMessaging() {
  return getMessaging(adminApp());
}

export async function requireActiveUser(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  if (!token) throw new Error("UNAUTHORIZED");

  const decoded = await adminAuth().verifyIdToken(token, true);
  const profileSnapshot = await adminDb().doc(`users/${decoded.uid}`).get();
  const profile = profileSnapshot.data() as
    | { active?: boolean; role?: string; displayName?: string; email?: string }
    | undefined;

  if (!profileSnapshot.exists || profile?.active !== true) {
    throw new Error("ACCOUNT_DISABLED");
  }

  return {
    uid: decoded.uid,
    email: String(profile?.email || decoded.email || ""),
    displayName: String(profile?.displayName || decoded.name || decoded.email || "RouteTrack User"),
    role: String(profile?.role || "staff").toLowerCase(),
  };
}
