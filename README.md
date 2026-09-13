# RouteTrack — PRF & SRF Monitoring System with Admin Control

A mobile-friendly document control system for logging PRF and SRF files, recording every handoff, locating the current holder, and identifying missing, overdue, or duplicate records.

## Account roles

### Administrator

- View every PRF and SRF record from all staff accounts
- View system-wide missing, overdue, and duplicate alerts
- Create staff or additional administrator accounts
- Assign a new document to a selected account
- Edit or delete any document
- Change a user's role, department, and application access
- Disable an account without deleting its records
- Export all visible records to CSV

### Staff

- View and manage only documents assigned to their account
- Add, edit, route, print, and export their records
- View their own dashboard and alerts

## Important: first administrator email

The first administrator is currently configured as:

```text
jerometable37@gmail.com
```

This email must be the same in both files:

```text
src/lib/admin-config.ts
firestore.rules
```

Create or sign in with that Firebase Authentication account. The app will automatically create its profile with the **admin** role.

## Run locally

Use Node.js 20.9 or newer. Open a terminal inside the project folder:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Without Firebase settings, select **Open admin demo dashboard**. Demo records and demo accounts remain only in that browser.

## Firebase setup

1. Create a Firebase project and register a Web App.
2. Enable **Authentication > Email/Password**.
3. Create a Firestore Database.
4. Open **Firestore Database > Rules**.
5. Replace the existing rules with `firestore.rules`, then click **Publish**.
6. Copy `.env.example` to `.env.local` and enter your Firebase configuration.
7. Restart `npm run dev`.

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

## Create the administrator

1. Open the app.
2. Choose **Create your account**.
3. Register using `jerometable37@gmail.com`.
4. Sign in if necessary.
5. The sidebar should display **Administrator** and show the **Users** menu.

The administrator can then open **Users > Create account** to make staff accounts with temporary passwords.

> Account disabling is application-level. It blocks Firestore access and the RouteTrack dashboard, but it does not delete or disable the Firebase Authentication identity itself.

## Updated Firestore structure

```text
users/{userId}
documents/{documentId}
documents/{documentId}/routes/{routeId}
```

The app automatically attempts to copy records from the previous personal structure when each existing user signs in:

```text
users/{userId}/documents/{documentId}
```

The old data is left untouched as a backup.

## Deploy to Vercel

1. Upload the project to GitHub.
2. Import the repository into Vercel.
3. Add the six Firebase environment variables.
4. Deploy.
5. Open the Vercel URL using the configured administrator email.

## Security reminder

Publish the updated `firestore.rules` before using the administrator features. The interface alone is not a security control; Firestore rules enforce which records each role can access.


## Student Assistant Routing Workflow

1. Add the PRF, CRF, or SRF before releasing the physical document.
2. Open the document and press **Route document** for every handoff.
3. Record the exact destination office/person and receiver acknowledgment. The routed date/time is filled automatically but can be corrected.
4. Use **My Routing Log** to see the latest holder and handoff date.
5. Open any item to see the complete chain of custody.
6. Export the routing log to CSV when a printed or backup report is needed.


## CRF edit fix

- CRF save now identifies each missing required field.
- Duplicate numbers are checked within the same document type only.
- Existing CRF records can be edited and saved without being blocked by a PRF/SRF number match.

## Google Sheets live monitoring automation

The monitoring spreadsheet can now act as the incoming source for RouteTrack. The sync layer:

- Reads the configured Google Sheet worksheet.
- Normalizes document number/type formats before matching.
- Reconciles against existing RouteTrack records to avoid creating duplicates for records already entered manually.
- Processes duplicate spreadsheet rows only once per sync.
- Updates the latest holder, status, requester, supplier, amount, due date, remarks, and physical location.
- Detects spreadsheet-driven holder/status changes and appends a source-tagged route/status event in the document history.
- Calculates automatic attention flags and a recommended next action.
- Excludes records marked as duplicates from dashboard totals.
- Stores sync-run statistics in `syncRuns` for administrator monitoring.
- Writes in chunks of 400 operations to stay below Firestore's batch-write limit.

### Automatic trigger on Vercel Hobby

Vercel Hobby does not allow a 15-minute Vercel Cron schedule, so `vercel.json` uses one daily backup cron. A GitHub Actions workflow is included to trigger the same protected endpoint every 15 minutes.

Add the same `CRON_SECRET` value to:

1. Vercel → Project Settings → Environment Variables
2. GitHub → Repository Settings → Secrets and variables → Actions → New repository secret

The GitHub workflow calls the deployed RouteTrack URL and uses that secret in the `Authorization: Bearer ...` header. It can also be run manually from the Actions tab using `workflow_dispatch`.
