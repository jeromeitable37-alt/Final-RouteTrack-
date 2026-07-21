import { cert, getApps, initializeApp } from "firebase-admin/app";
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

export function adminDb() {
  return getFirestore(adminApp());
}

export function adminMessaging() {
  return getMessaging(adminApp());
}

type FirebaseLookupUser = {
  localId?: string;
  email?: string;
  displayName?: string;
  disabled?: boolean;
};

type FirebaseLookupResponse = {
  users?: FirebaseLookupUser[];
  error?: {
    message?: string;
  };
};

/**
 * Validates the Firebase client ID token through Firebase Authentication's
 * official accounts:lookup REST endpoint.
 *
 * This intentionally avoids importing firebase-admin/auth because
 * firebase-admin 14 currently pulls an ESM-only JOSE dependency through
 * jwks-rsa that can fail inside some Vercel CommonJS function runtimes.
 */
async function verifyFirebaseUser(idToken: string): Promise<{
  uid: string;
  email: string;
  displayName: string;
}> {
  const apiKey = required("NEXT_PUBLIC_FIREBASE_API_KEY");

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ idToken }),
      cache: "no-store",
    },
  );

  const result = (await response.json().catch(() => ({}))) as FirebaseLookupResponse;
  const account = result.users?.[0];

  if (!response.ok || !account?.localId) {
    console.error(
      "Firebase ID-token lookup failed:",
      result.error?.message || response.status,
    );
    throw new Error("UNAUTHORIZED");
  }

  if (account.disabled === true) {
    throw new Error("ACCOUNT_DISABLED");
  }

  return {
    uid: account.localId,
    email: String(account.email || ""),
    displayName: String(account.displayName || account.email || "RouteTrack User"),
  };
}

export async function requireActiveUser(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  if (!token) throw new Error("UNAUTHORIZED");

  const verifiedUser = await verifyFirebaseUser(token);
  const profileSnapshot = await adminDb().doc(`users/${verifiedUser.uid}`).get();
  const profile = profileSnapshot.data() as
    | {
        active?: boolean;
        role?: string;
        displayName?: string;
        email?: string;
      }
    | undefined;

  if (!profileSnapshot.exists || profile?.active !== true) {
    throw new Error("ACCOUNT_DISABLED");
  }

  return {
    uid: verifiedUser.uid,
    email: String(profile?.email || verifiedUser.email || ""),
    displayName: String(
      profile?.displayName ||
        verifiedUser.displayName ||
        verifiedUser.email ||
        "RouteTrack User",
    ),
    role: String(profile?.role || "staff").toLowerCase(),
  };
}
