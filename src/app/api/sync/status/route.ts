import { requireActiveUser, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireActiveUser(request);
    if (user.role !== "admin") {
      return Response.json({ ok: false, error: "Administrator access is required." }, { status: 403 });
    }
    const snapshot = await adminDb().collection("syncRuns").orderBy("completedAt", "desc").limit(1).get();
    const latest = snapshot.docs[0];
    return Response.json({ ok: true, latest: latest ? { id: latest.id, ...latest.data() } : null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read synchronization status.";
    return Response.json({ ok: false, error: message }, { status: message === "UNAUTHORIZED" ? 401 : 500 });
  }
}
