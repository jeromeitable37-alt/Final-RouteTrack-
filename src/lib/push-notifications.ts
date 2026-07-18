"use client";

import {
  getMessaging,
  isSupported,
  onMessage,
  onRegistered,
  onUnregistered,
  register as registerMessaging,
  unregister as unregisterMessaging,
  type MessagePayload,
} from "firebase/messaging";
import { auth, firebaseApp } from "@/lib/firebase";
import type { SessionUser } from "@/lib/types";

const ENABLED_KEY = "routetrack-push-enabled";
const FID_KEY = "routetrack-push-fid";
const SW_PATH = "/firebase-messaging-sw";

export type PushSendInput = {
  recipientUid?: string;
  recipientRole?: "admin";
  title: string;
  body: string;
  url?: string;
  category?: "message" | "document" | "system" | "test";
};

async function authHeaders(): Promise<Record<string, string>> {
  const currentUser = auth?.currentUser;
  if (!currentUser) throw new Error("Sign in before using phone notifications.");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${await currentUser.getIdToken()}`,
  };
}

async function postJson(path: string, body: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });

  const result = (await response.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
    [key: string]: unknown;
  };

  if (!response.ok) {
    throw new Error(result.error || result.message || "Unable to complete the notification request.");
  }

  return result;
}

export function isPushEnabledLocally(): boolean {
  return typeof window !== "undefined" && localStorage.getItem(ENABLED_KEY) === "true";
}

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function isStandaloneApp(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export async function pushSupport(): Promise<{
  supported: boolean;
  reason?: string;
}> {
  if (typeof window === "undefined") return { supported: false, reason: "Browser unavailable." };
  if (!("serviceWorker" in navigator) || !("Notification" in window)) {
    return { supported: false, reason: "This browser does not support web push notifications." };
  }
  if (!firebaseApp) return { supported: false, reason: "Firebase is not configured." };
  if (!(await isSupported())) return { supported: false, reason: "Firebase Messaging is not supported by this browser." };
  if (!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) {
    return { supported: false, reason: "The Firebase Web Push key is not configured." };
  }
  if (isIosDevice() && !isStandaloneApp()) {
    return {
      supported: false,
      reason: "On iPhone or iPad, add RouteTrack to the Home Screen first, then open the installed app.",
    };
  }
  return { supported: true };
}

async function serviceWorkerRegistration() {
  const registration = await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
  await navigator.serviceWorker.ready;
  return registration;
}

async function saveRegistration(fid: string, user: SessionUser) {
  await postJson("/api/push/register", {
    fid,
    deviceName: (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform || "Web device",
    userAgent: navigator.userAgent,
    userName: user.displayName,
  });
  localStorage.setItem(FID_KEY, fid);
  localStorage.setItem(ENABLED_KEY, "true");
}

async function registerAndWaitForFid(user: SessionUser): Promise<string> {
  const support = await pushSupport();
  if (!support.supported) throw new Error(support.reason || "Push notifications are unavailable.");

  const registration = await serviceWorkerRegistration();
  const messaging = getMessaging(firebaseApp!);

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        stopRegistered();
        reject(new Error("Notification registration timed out. Refresh the page and try again."));
      }
    }, 20000);

    const stopRegistered = onRegistered(messaging, async (fid) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      stopRegistered();
      try {
        await saveRegistration(fid, user);
        resolve(fid);
      } catch (error) {
        reject(error);
      }
    });

    void registerMessaging(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    }).catch((error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      stopRegistered();
      reject(error);
    });
  });
}

export async function enablePushNotifications(user: SessionUser): Promise<void> {
  const support = await pushSupport();
  if (!support.supported) throw new Error(support.reason || "Push notifications are unavailable.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted. Allow notifications in your browser or phone settings.");
  }

  await registerAndWaitForFid(user);
}

export async function refreshPushRegistration(user: SessionUser): Promise<void> {
  if (!isPushEnabledLocally() || Notification.permission !== "granted") return;
  await registerAndWaitForFid(user);
}

export async function disablePushNotifications(): Promise<void> {
  const fid = localStorage.getItem(FID_KEY) || "";
  if (fid) {
    await postJson("/api/push/unregister", { fid }).catch(() => undefined);
  }

  if (firebaseApp && (await isSupported())) {
    await unregisterMessaging(getMessaging(firebaseApp)).catch(() => undefined);
  }

  localStorage.removeItem(FID_KEY);
  localStorage.removeItem(ENABLED_KEY);
  if ("clearAppBadge" in navigator) {
    await (navigator as unknown as { clearAppBadge: () => Promise<void> }).clearAppBadge().catch(() => undefined);
  }
}

export function listenForPushRegistrationChanges() {
  if (!firebaseApp || typeof window === "undefined") return () => undefined;
  let stopRegistered: () => void = () => {};
  let stopUnregistered: () => void = () => {};

  void isSupported().then((supported) => {
    if (!supported || !firebaseApp) return;
    const messaging = getMessaging(firebaseApp);

    stopRegistered = onRegistered(messaging, (fid) => {
      localStorage.setItem(FID_KEY, fid);
    });

    stopUnregistered = onUnregistered(messaging, (fid) => {
      if (localStorage.getItem(FID_KEY) === fid) {
        localStorage.removeItem(FID_KEY);
        localStorage.removeItem(ENABLED_KEY);
      }
    });
  });

  return () => {
    stopRegistered();
    stopUnregistered();
  };
}

export function listenForForegroundPush(
  onPayload: (payload: MessagePayload) => void,
): () => void {
  if (!firebaseApp || typeof window === "undefined") return () => undefined;
  let unsubscribe: () => void = () => {};

  void isSupported().then((supported) => {
    if (!supported || !firebaseApp) return;
    unsubscribe = onMessage(getMessaging(firebaseApp), async (payload) => {
      onPayload(payload);

      const title = payload.data?.title || payload.notification?.title || "RouteTrack";
      const body = payload.data?.body || payload.notification?.body || "You have a new update.";
      const url = payload.data?.url || "/";
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: payload.messageId || `${title}:${body}`,
        data: { url },
      });

      if ("setAppBadge" in navigator) {
        await (navigator as unknown as { setAppBadge: (count?: number) => Promise<void> }).setAppBadge(1).catch(() => undefined);
      }
    });
  });

  return () => unsubscribe();
}

export async function sendPushNotification(input: PushSendInput): Promise<void> {
  if (!auth?.currentUser) return;
  await postJson("/api/push/send", input);
}

export async function sendTestPush(): Promise<void> {
  await postJson("/api/push/test", {});
}
