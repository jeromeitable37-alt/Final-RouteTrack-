import { FieldValue } from "firebase-admin/firestore";
import { adminDb, adminMessaging, requireActiveUser } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const ALLOWED_CATEGORIES = new Set(["message", "document", "system", "test"]);

function clean(value: unknown, maximum: number): string {
  return String(value || "").replace(/[<>]/g, "").trim().slice(0, maximum);
}

export async function POST(request: Request) {
  try {
    const sender = await requireActiveUser(request);
    const body = (await request.json()) as {
      recipientUid?: string;
      recipientRole?: string;
      title?: string;
      body?: string;
      url?: string;
      category?: string;
    };

    const recipientUid = clean(body.recipientUid, 128);
    const recipientRole = clean(body.recipientRole, 32).toLowerCase();
    const title = clean(body.title, 100);
    const messageBody = clean(body.body, 240);
    const category = clean(body.category || "system", 32).toLowerCase();
    const relativeUrl = clean(body.url || "/", 500) || "/";

    if (!title || !messageBody || !ALLOWED_CATEGORIES.has(category)) {
      return Response.json({ error: "Invalid notification content." }, { status: 400 });
    }
    if (!recipientUid && recipientRole !== "admin") {
      return Response.json({ error: "Select a notification recipient." }, { status: 400 });
    }

    const allDevices = await adminDb().collection("pushDevices").where("enabled", "==", true).get();
    const targets = allDevices.docs.filter((document: { data: () => Record<string, unknown>; id: string; ref: { set: (data: unknown, options?: unknown) => Promise<unknown> } }) => {
      const data = document.data();
      if (recipientUid) return data.userUid === recipientUid;
      return recipientRole === "admin" && data.userRole === "admin" && data.userUid !== sender.uid;
    });

    if (!targets.length) {
      return Response.json({ ok: true, sent: 0, message: "The recipient has not enabled phone alerts." });
    }

    const fids = targets.map((document: { id: string }) => document.id).slice(0, 500);
    const absoluteUrl = new URL(relativeUrl.startsWith("/") ? relativeUrl : "/", request.url).toString();

    const result = await adminMessaging().sendEachForMulticast({
      fids,
      data: {
        title,
        body: messageBody,
        url: absoluteUrl,
        category,
        senderUid: sender.uid,
      },
      webpush: {
        headers: { Urgency: category === "message" ? "high" : "normal" },
        fcmOptions: { link: absoluteUrl },
      },
    });

    const writes = result.responses.map((response, index) => {
      const reference = targets[index].ref;
      if (response.success) {
        return reference.set({ lastSuccessfulAt: FieldValue.serverTimestamp() }, { merge: true });
      }
      const code = String(response.error?.code || "");
      if (
        code.includes("registration-token-not-registered") ||
        code.includes("invalid-registration-token") ||
        code.includes("invalid-recipient") ||
        code.includes("not-found")
      ) {
        return reference.set({ enabled: false, disabledReason: code, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }
      return Promise.resolve();
    });
    await Promise.all(writes);

    return Response.json({ ok: true, sent: result.successCount, failed: result.failureCount });
  } catch (error) {
    console.error("RouteTrack push send failed", error);
    const message = error instanceof Error ? error.message : "Unable to send the notification.";
    const status = message === "UNAUTHORIZED" ? 401 : message === "ACCOUNT_DISABLED" ? 403 : 500;
    return Response.json({ error: status === 500 ? "Unable to send the phone notification. Check the server configuration." : message }, { status });
  }
}
