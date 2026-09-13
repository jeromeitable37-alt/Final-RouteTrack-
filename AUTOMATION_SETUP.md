# RouteTrack automatic spreadsheet monitoring

This version adds smart reconciliation, change detection, route/status history updates, duplicate handling, auto-check flags, sync-run history, and automatic triggering.

## Vercel
- Set `CRON_SECRET` in Vercel Environment Variables.
- Keep the existing Firebase Admin variables configured.
- `vercel.json` keeps a daily Vercel Cron as a backup because Vercel Hobby does not allow a 15-minute Cron schedule.

## GitHub Actions
A workflow in `.github/workflows/routetrack-spreadsheet-sync.yml` calls the deployed RouteTrack endpoint every 15 minutes.

Add the same `CRON_SECRET` as a GitHub repository Actions secret: **Settings → Secrets and variables → Actions → New repository secret**.

The workflow uses the deployed URL `https://final-route-track.vercel.app`. Use `workflow_dispatch` in GitHub Actions to trigger a test immediately.

## What synchronization does
- Reads the monitoring worksheet from the configured Google Sheet.
- Normalizes document type/number and matches old RouteTrack records before creating anything new.
- Deduplicates repeated spreadsheet rows during a sync and marks duplicate Firestore records so dashboard counts do not double-count them.
- Updates fields such as holder, status, requester, supplier, amount, due date, physical location, and remarks.
- Detects holder/status changes and appends a source-tagged event into the document's routing history.
- Calculates automatic attention flags and recommendations after each sync.
- Stores sync-run totals in `syncRuns` so administrators can see the latest automatic sync.
- Writes in chunks of 400 operations so large sheets do not hit Firestore's 500-write batch limit.

## Important
The system cannot physically move a paper document. Human confirmation is still required for physical handoffs. The automatic layer is designed to keep the digital monitoring record current and surface what needs human attention.
