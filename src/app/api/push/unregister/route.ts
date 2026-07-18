import { adminDb, requireActiveUser } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireActiveUser(request);
    const body = (await request.json()) as { fid?: string };
    const fid = String(body.fid || "").trim();
    if (!fid) return Response.json({ ok: true });

    const reference = adminDb().collection("pushDevices").doc(fid);
    const snapshot = await reference.get();
    if (snapshot.exists && snapshot.data()?.userUid === user.uid) {
      await reference.delete();
    }

    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to disable notifications.";
    const status = message === "UNAUTHORIZED" ? 401 : message === "ACCOUNT_DISABLED" ? 403 : 500;
    return Response.json({ error: status === 500 ? "Unable to disable notifications." : message }, { status });
  }
}
