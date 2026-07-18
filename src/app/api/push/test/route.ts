import { adminDb, adminMessaging, requireActiveUser } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireActiveUser(request);
    const snapshot = await adminDb().collection("pushDevices").where("enabled", "==", true).get();
    const fids = snapshot.docs
      .filter((document: { data: () => Record<string, unknown> }) => document.data().userUid === user.uid)
      .map((document: { id: string }) => document.id)
      .slice(0, 500);

    if (!fids.length) {
      return Response.json({ error: "No active notification device is registered for your account." }, { status: 404 });
    }

    const url = new URL("/?view=dashboard", request.url).toString();
    const result = await adminMessaging().sendEachForMulticast({
      fids,
      data: {
        title: "RouteTrack test notification",
        body: "Phone notifications are working on this device.",
        url,
        category: "test",
        senderUid: user.uid,
      },
      webpush: { headers: { Urgency: "high" }, fcmOptions: { link: url } },
    });

    return Response.json({ ok: true, sent: result.successCount, failed: result.failureCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send the test notification.";
    const status = message === "UNAUTHORIZED" ? 401 : message === "ACCOUNT_DISABLED" ? 403 : 500;
    return Response.json({ error: status === 500 ? "Unable to send the test notification." : message }, { status });
  }
}
