import { FieldValue } from "firebase-admin/firestore";
import { adminDb, requireActiveUser } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireActiveUser(request);
    const body = (await request.json()) as {
      fid?: string;
      deviceName?: string;
      userAgent?: string;
    };
    const fid = String(body.fid || "").trim();
    if (!fid || fid.length > 300) {
      return Response.json({ error: "Invalid notification device registration." }, { status: 400 });
    }

    const reference = adminDb().collection("pushDevices").doc(fid);
    const existing = await reference.get();
    await reference.set(
      {
        fid,
        userUid: user.uid,
        userEmail: user.email,
        userName: user.displayName,
        userRole: user.role,
        enabled: true,
        deviceName: String(body.deviceName || "Web device").slice(0, 120),
        userAgent: String(body.userAgent || "").slice(0, 500),
        updatedAt: FieldValue.serverTimestamp(),
        ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      },
      { merge: true },
    );

    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to register this device.";
    const status = message === "UNAUTHORIZED" ? 401 : message === "ACCOUNT_DISABLED" ? 403 : 500;
    return Response.json({ error: status === 500 ? "Unable to register this device." : message }, { status });
  }
}
