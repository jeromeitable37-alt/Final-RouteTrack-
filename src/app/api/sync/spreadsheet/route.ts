import { syncSpreadsheet } from "@/lib/spreadsheet-sync";
import { requireActiveUser } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(error: unknown) {
  const message = error instanceof Error ? error.message : "Spreadsheet synchronization failed.";
  const status = message === "UNAUTHORIZED" ? 401 : message === "ACCOUNT_DISABLED" ? 403 : 500;
  return Response.json({ ok: false, error: status === 500 ? message : message }, { status });
}

export async function POST(request: Request) {
  try {
    const user = await requireActiveUser(request);
    if (user.role !== "admin") return Response.json({ ok: false, error: "Administrator access is required." }, { status: 403 });
    const result = await syncSpreadsheet(user);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("RouteTrack spreadsheet sync failed", error);
    return jsonError(error);
  }
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") || "";
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: "Unauthorized cron request." }, { status: 401 });
  }

  try {
    const actor = {
      uid: process.env.ROUTETRACK_SYNC_ACTOR_UID || "system-spreadsheet-sync",
      displayName: "Google Sheets Sync",
      email: process.env.ROUTETRACK_SYNC_ACTOR_EMAIL || "system@routetrack.local",
    };
    const result = await syncSpreadsheet(actor);
    return Response.json({ ok: true, automatic: true, ...result });
  } catch (error) {
    console.error("RouteTrack scheduled spreadsheet sync failed", error);
    return jsonError(error);
  }
}
