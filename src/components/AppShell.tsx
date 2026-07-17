"use client";

import { useEffect, useMemo, useState } from "react";
import { signOut } from "firebase/auth";
import {
  AlertTriangle,
  Archive,
  BarChart3,
  ClipboardList,
  Clock3,
  Download,
  FilePlus2,
  HardDriveDownload,
  History,
  LogOut,
  Menu,
  MessageCircle,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  UserPlus,
  Users,
  UserRound,
  X,
} from "lucide-react";
import { auth, firebaseConfigured } from "@/lib/firebase";
import { subscribeUnreadMessageCount } from "@/lib/message-service";
import {
  addActivityLog,
  addDocument,
  addRoute,
  createManagedUser,
  getRoutes,
  migrateLegacyDocuments,
  subscribeActivityLogs,
  subscribeAllDocuments,
  subscribeDocuments,
  subscribeUsers,
  updateDocument,
  updateManagedUser,
} from "@/lib/data-service";
import {
  ActivityRecord,
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
  DocumentRecord,
  DocumentSubmission,
  ManagedUserInput,
  SessionUser,
  UserProfile,
} from "@/lib/types";
import { csvDownload, formatCurrency, formatDateTime, jsonDownload, statusClass } from "@/lib/utils";
import { Modal } from "./Modal";
import { DocumentForm } from "./DocumentForm";
import { DocumentDetails } from "./DocumentDetails";
import { UserForm } from "./UserForm";
import { ProfileForm } from "./ProfileForm";
import { Avatar } from "./Avatar";
import { InstallAppButton } from "./PwaSupport";
import { MessagesPage } from "./MessagesPage";
import { MonthlyDocumentsChart } from "./MonthlyDocumentsChart";
import { ThemeToggle } from "./ThemeToggle";

type View = "dashboard" | "documents" | "routes" | "alerts" | "archive" | "activity" | "messages" | "users" | "profile";

function isAdminRole(role: unknown): boolean {
  return String(role || "").trim().toLowerCase() === "admin";
}

function normalizeStatus(status: unknown): string {
  return String(status || "").trim().toLowerCase();
}

export function AppShell({ user, onDemoLogout }: { user: SessionUser; onDemoLogout: () => void }) {
  const isAdmin = isAdminRole(user.role);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [routeHistoryIndex, setRouteHistoryIndex] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentRecord | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ownerUid, setOwnerUid] = useState(user.uid);
  const [userFormOpen, setUserFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [userSearch, setUserSearch] = useState("");
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    let unsubscribe: () => void = () => {};
    let cancelled = false;
    setLoading(true);
    void migrateLegacyDocuments(user).catch(() => undefined).finally(() => {
      if (cancelled) return;
      unsubscribe = isAdmin
        ? subscribeAllDocuments((items) => { setDocuments(items); setLoading(false); })
        : subscribeDocuments(user.uid, (items) => { setDocuments(items); setLoading(false); });
    });
    return () => { cancelled = true; unsubscribe(); };
  }, [user.uid, user.displayName, user.email, isAdmin]);

  useEffect(() => subscribeUsers(setUsers), []);

  useEffect(
    () => subscribeUnreadMessageCount(user.uid, setUnreadMessages),
    [user.uid],
  );

  useEffect(() => subscribeActivityLogs(user, setActivities), [user.uid, user.role]);

  useEffect(() => {
    let cancelled = false;
    const targets = documents.filter((item) => !item.routeSearchText);
    if (!targets.length) {
      setRouteHistoryIndex({});
      return;
    }
    void Promise.all(targets.map(async (item) => {
      const routes = await getRoutes(item.id);
      const text = routes.flatMap((route) => [
        route.fromOffice,
        route.toOffice,
        route.actionPurpose,
        route.receivedBy,
        route.proofReference,
        route.receiverConfirmation,
        route.createdByName,
      ]).filter(Boolean).join(" ");
      return [item.id, text] as const;
    })).then((entries) => {
      if (!cancelled) setRouteHistoryIndex(Object.fromEntries(entries));
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [documents]);

  useEffect(() => {
    if (!documents.length || typeof window === "undefined") return;
    const requestedId = new URLSearchParams(window.location.search).get("document");
    if (requestedId && documents.some((item) => item.id === requestedId)) {
      setSelectedId(requestedId);
      setView("documents");
    }
  }, [documents]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (view === "users" && !isAdmin) setView("dashboard");
  }, [isAdmin, view]);

  const userMap = useMemo(() => new Map(users.map((item) => [item.uid, item])), [users]);
  const activeOwnerOptions = useMemo(() => users.filter((item) => item.active), [users]);
  const selected = selectedId ? documents.find((item) => item.id === selectedId) || null : null;

  const visibleDocuments = documents.filter((item) => !item.archivedAt);
  const archivedDocuments = documents.filter((item) => Boolean(item.archivedAt));

  const requestCounts = useMemo(() => visibleDocuments.reduce<Record<string, number>>((acc, item) => {
    const key = item.requestNo.trim().toLowerCase();
    if (key) acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {}), [visibleDocuments]);

  const missing = visibleDocuments.filter((item) => normalizeStatus(item.status) === "missing");
  const completed = visibleDocuments.filter((item) => normalizeStatus(item.status) === "completed");
  const active = visibleDocuments.filter((item) => {
    const status = normalizeStatus(item.status);
    return status !== "completed" && status !== "cancelled";
  });
  const routingDocuments = [...visibleDocuments]
    .filter((item) => item.lastRoutedAt)
    .sort((a, b) => String(b.lastRoutedAt).localeCompare(String(a.lastRoutedAt)));
  const unacknowledged = routingDocuments.filter((item) => {
    const status = normalizeStatus(item.status);
    if (status === "completed" || status === "cancelled") return false;
    if (!item.lastRoutedAt || item.lastReceivedBy || item.lastReceivedAt) return false;
    return Date.now() - new Date(item.lastRoutedAt).getTime() > 86_400_000;
  });
  const stalled = active.filter((item) => {
    const last = item.lastRoutedAt || item.updatedAt || item.createdAt;
    return Date.now() - new Date(last).getTime() > 3 * 86_400_000;
  });
  const duplicates = visibleDocuments.filter((item) => requestCounts[item.requestNo.trim().toLowerCase()] > 1);
  const alerts = [...new Map([...missing, ...unacknowledged, ...stalled, ...duplicates].map((item) => [item.id, item])).values()];

  const localToday = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  const routedToday = routingDocuments.filter((item) => String(item.lastRoutedAt || "").slice(0, 10) === localToday);
  const completedToday = completed.filter((item) => String(item.completedAt || item.updatedAt || "").slice(0, 10) === localToday);

  function documentSearchText(item: DocumentRecord): string {
    const owner = userMap.get(item.ownerUid);
    return [
      item.type,
      item.requestNo,
      item.organization,
      item.currentHolder,
      item.purchasingEmployee || item.requestor,
      item.supplier,
      item.itemsDescription || item.subjectPurpose,
      owner?.displayName || item.ownerName,
      item.lastFromOffice,
      item.lastToOffice,
      item.lastRoutePurpose,
      item.lastReceivedBy,
      item.lastRouteEncodedBy,
      item.routeSearchText,
      routeHistoryIndex[item.id],
    ].filter(Boolean).join(" ").toLowerCase();
  }

  const normalizedSearch = search.trim().toLowerCase();
  const filteredDocuments = visibleDocuments.filter((item) => {
    return documentSearchText(item).includes(normalizedSearch)
      && (typeFilter === "All" || item.type === typeFilter)
      && (statusFilter === "All" || normalizeStatus(item.status) === normalizeStatus(statusFilter));
  });

  const finderResults = normalizedSearch
    ? visibleDocuments.filter((item) => documentSearchText(item).includes(normalizedSearch)).slice(0, 10)
    : routingDocuments.slice(0, 6);

  const filteredRoutes = routingDocuments.filter((item) => {
    return documentSearchText(item).includes(normalizedSearch)
      && (typeFilter === "All" || item.type === typeFilter);
  });

  const filteredUsers = users.filter((profile) => `${profile.displayName} ${profile.email} ${profile.department} ${profile.position || ""} ${profile.role}`.toLowerCase().includes(userSearch.toLowerCase()));

  function notify(message: string, error = false) { setToast({ message, error }); }
  function openView(next: View) { setView(next); setMenuOpen(false); }
  function newDocument() { setEditing(null); setOwnerUid(user.uid); setFormOpen(true); }
  function editDocument(document: DocumentRecord) { setEditing(document); setOwnerUid(document.ownerUid); setFormOpen(true); }
  function newUser() { setEditingUser(null); setUserFormOpen(true); }
  function editUser(profile: UserProfile) { setEditingUser(profile); setUserFormOpen(true); }

  async function saveDocument(submission: DocumentSubmission) {
    try {
      if (editing) {
        await updateDocument(editing.id, submission.document);
        await addActivityLog(user, "EDITED", `${editing.type} ${editing.requestNo} information updated.`, editing);
        notify("Document information updated.");
      } else {
        const owner = userMap.get(ownerUid) || user;
        const isSingleRouteDocument =
          submission.document.type === "CRF" ||
          submission.document.type === "PO";
        const id = await addDocument(owner, submission.document);
        await addRoute(user, id, submission.initialRoute);
        await updateDocument(id, {
          routeCount: 1,
          currentHolder: submission.initialRoute.toOffice,
          // CRF and PO are single-route documents, but they remain
          // In Transit until the receiving person is acknowledged.
          status: "In Transit",
          completedAt: "",
          lastRoutedAt: submission.initialRoute.dateTimeRouted,
          lastFromOffice: submission.initialRoute.fromOffice,
          lastToOffice: submission.initialRoute.toOffice,
          lastRoutePurpose: submission.initialRoute.actionPurpose,
          lastReceivedBy: submission.initialRoute.receivedBy,
          lastReceivedAt: submission.initialRoute.dateTimeReceived,
          lastMovementStatus: submission.initialRoute.movementStatus,
          lastRouteEncodedBy: user.displayName || user.email,
          lastProofReference: submission.initialRoute.proofReference,
          routeSearchText: [
            submission.initialRoute.fromOffice,
            submission.initialRoute.toOffice,
            submission.initialRoute.actionPurpose,
          ].join(" "),
        });
        await addActivityLog(user, "CREATED", `${submission.document.type} ${submission.document.requestNo} recorded and routed to ${submission.initialRoute.toOffice}.`, {
          id,
          type: submission.document.type,
          requestNo: submission.document.requestNo,
        });
        notify(
          isSingleRouteDocument
            ? `${submission.document.type} recorded. Confirm receipt to mark it Completed; no Route next action is required.`
            : "Document and first routing entry saved. Status: In Transit."
        );
      }
      setFormOpen(false);
      setEditing(null);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Unable to save the document.", true);
    }
  }

  async function saveUserAccount(input: ManagedUserInput) {
    try {
      if (editingUser) {
        if (editingUser.uid === user.uid && (!input.active || input.role !== "admin")) {
          notify("You cannot disable your own account or remove your administrator role.", true);
          return;
        }
        await updateManagedUser(editingUser.uid, {
          displayName: input.displayName.trim(),
          department: input.department.trim(),
          position: String(input.position || "").trim(),
          phone: String(input.phone || "").trim(),
          photoDataUrl: String(input.photoDataUrl || ""),
          role: input.role,
          active: input.active,
        });
        await addActivityLog(user, "USER_UPDATED", `${input.displayName} account updated.`);
        notify("User account updated.");
      } else {
        await createManagedUser(input);
        await addActivityLog(user, "USER_CREATED", `${input.displayName} account created.`);
        notify("New user account created.");
      }
      setUserFormOpen(false);
      setEditingUser(null);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to save the account.";
      notify(message.replace("Firebase: ", "").replace(/\(auth\/.+\)\.?/, ""), true);
    }
  }

  async function saveProfile(changes: Partial<UserProfile>) {
    try {
      await updateManagedUser(user.uid, changes);
      await addActivityLog(user, "PROFILE_UPDATED", "Profile information updated.");
      notify("Profile updated.");
    } catch {
      notify("Unable to update your profile.", true);
    }
  }

  async function logout() {
    if (firebaseConfigured && auth) await signOut(auth); else onDemoLogout();
  }

  function exportDocuments() {
    csvDownload("routetrack-documents.csv", filteredDocuments.map((item) => ({
      Type: item.type,
      Number: item.requestNo,
      Organization: item.organization || "",
      "Date routed": item.lastRoutedAt || item.createdAt,
      "Current holder": item.currentHolder,
      "Purchasing employee": item.purchasingEmployee || item.requestor,
      Supplier: item.supplier || "",
      Amount: item.amount || 0,
      Description: item.itemsDescription || item.subjectPurpose,
      "PO terms": item.paymentTerms || "",
      Status: item.status,
      "Recorded by": item.ownerName,
    })));
  }

  function exportRoutes() {
    csvDownload("routetrack-routing-log.csv", filteredRoutes.map((item) => ({
      Type: item.type,
      Number: item.requestNo,
      Organization: item.organization || "",
      "Date/time routed": item.lastRoutedAt || "",
      From: item.lastFromOffice || "",
      To: item.lastToOffice || item.currentHolder,
      Purpose: item.lastRoutePurpose || "",
      "Received by": item.lastReceivedBy || "",
      "Recorded by": item.lastRouteEncodedBy || item.ownerName,
    })));
  }

  async function exportBackup() {
    try {
      const routeEntries = await Promise.all(documents.map(async (item) => ({
        documentId: item.id,
        label: `${item.type} ${item.requestNo}`,
        routes: await getRoutes(item.id),
      })));
      jsonDownload(`routetrack-backup-${localToday}.json`, {
        exportedAt: new Date().toISOString(),
        exportedBy: user.email,
        documents,
        users: isAdmin ? users : [user],
        routes: routeEntries,
        activities,
      });
      notify("Backup downloaded.");
    } catch {
      notify("Unable to prepare the backup.", true);
    }
  }

  const viewTitle = view === "dashboard" ? (isAdmin ? "Administrator dashboard" : "My routing dashboard")
    : view === "documents" ? "Document register"
      : view === "routes" ? "Routing history"
        : view === "alerts" ? "Documents to check"
          : view === "archive" ? "Archived documents"
            : view === "activity" ? "Activity log"
              : view === "messages" ? "Messages"
                : view === "users" ? "User management"
                  : "My profile";

  return (
    <div className="app-layout">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand"><div className="brand-icon"><ClipboardList size={22} /></div><div><strong>RouteTrack</strong><span>PRF / SRF / CRF / PO</span></div><button className="mobile-close" onClick={() => setMenuOpen(false)}><X size={20} /></button></div>
        {isAdmin && <div className="admin-sidebar-badge"><ShieldCheck size={15} /> Administrator</div>}
        <nav>
          <button className={view === "dashboard" ? "active" : ""} onClick={() => openView("dashboard")}><BarChart3 size={19} /> Dashboard</button>
          <button className={view === "documents" ? "active" : ""} onClick={() => openView("documents")}><ClipboardList size={19} /> Documents <span>{visibleDocuments.length}</span></button>
          <button className={view === "routes" ? "active" : ""} onClick={() => openView("routes")}><Clock3 size={19} /> Routing log <span>{routingDocuments.length}</span></button>
          <button className={view === "alerts" ? "active" : ""} onClick={() => openView("alerts")}><ShieldAlert size={19} /> To check <span className={alerts.length ? "nav-alert" : ""}>{alerts.length}</span></button>
          <button className={view === "archive" ? "active" : ""} onClick={() => openView("archive")}><Archive size={19} /> Archive <span>{archivedDocuments.length}</span></button>
          <button className={view === "activity" ? "active" : ""} onClick={() => openView("activity")}><History size={19} /> Activity <span>{activities.length}</span></button>
          <button className={view === "messages" ? "active" : ""} onClick={() => openView("messages")}><MessageCircle size={19} /> Messages {unreadMessages > 0 && <span className="nav-alert">{unreadMessages}</span>}</button>
          {isAdmin && <button className={view === "users" ? "active" : ""} onClick={() => openView("users")}><Users size={19} /> Users <span>{users.length}</span></button>}
          <button className={view === "profile" ? "active" : ""} onClick={() => openView("profile")}><UserRound size={19} /> My profile</button>
        </nav>
        <div className="sidebar-footer">
          <button className="user-card user-card-button" onClick={() => openView("profile")}><Avatar name={user.displayName} photoDataUrl={user.photoDataUrl} /><div><strong>{user.displayName}</strong><span>{user.position || user.department || (isAdmin ? "Administrator" : "Staff")}</span></div></button>
          <button className="logout-button" onClick={logout}><LogOut size={18} /> Sign out</button>
        </div>
      </aside>
      {menuOpen && <div className="sidebar-overlay" onClick={() => setMenuOpen(false)} />}

      <main className="main-content">
        <header className="topbar"><button className="menu-button" onClick={() => setMenuOpen(true)}><Menu size={20} /></button><div><p className="eyebrow">ROUTETRACK</p><h1>{viewTitle}</h1></div><div className="topbar-actions"><ThemeToggle /><InstallAppButton />{view !== "users" && view !== "profile" && view !== "messages" && <button className="primary-button top-add" onClick={newDocument}><Plus size={17} /> Quick log</button>}</div></header>
        {user.isDemo && <div className="demo-banner"><AlertTriangle size={17} /> Demo mode: records are stored only in this browser.</div>}

        {view === "dashboard" && <div className="page-section">
          <section className="metric-grid">
            <Metric label="Total records" value={visibleDocuments.length} note="Active PRF, SRF, CRF, and PO" />
            <Metric label="Currently active" value={active.length} note="Not completed or cancelled" />
            <Metric label="No acknowledgment" value={unacknowledged.length} note="Routed over one day ago" alert={unacknowledged.length > 0} />
            <Metric label="Completed" value={completed.length} note="Closed routing records" positive />
          </section>

          <section className="daily-summary-strip">
            <MiniMetric label="Routed today" value={routedToday.length} />
            <MiniMetric label="Completed today" value={completedToday.length} />
            <MiniMetric label="Pending follow-up" value={alerts.length} />
            <MiniMetric label="Staying over 3 days" value={stalled.length} />
          </section>

          <MonthlyDocumentsChart documents={documents} />

          <section className="document-finder panel">
            <div className="finder-heading"><div><p className="eyebrow">WHERE IS THE DOCUMENT?</p><h2>Search by document number, approver, receiver, supplier, or office.</h2></div>{isAdmin && <button className="secondary-button" onClick={() => void exportBackup()}><HardDriveDownload size={16} /> Download backup</button>}</div>
            <div className="search-box finder-search"><Search size={19} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Example: Ms. Trixie Araneta, Marc Marquez, PRF 1025, supplier…" /></div>
            <div className="finder-results">{finderResults.length ? finderResults.map((item) => <button key={item.id} onClick={() => setSelectedId(item.id)}><div><strong>{item.type} {item.requestNo}</strong><span>{item.organization || "No organization"} · {item.status}</span></div><div><span>Current holder</span><strong>{item.currentHolder}</strong></div><div><span>Last routed</span><strong>{formatDateTime(item.lastRoutedAt || item.createdAt)}</strong></div></button>) : <div className="empty-panel">No matching document or approver found.</div>}</div>
            {normalizedSearch && <div className="finder-footer"><span>{visibleDocuments.filter((item) => documentSearchText(item).includes(normalizedSearch)).length} matching file(s)</span><button className="text-button" onClick={() => setView("documents")}>Show all matching files</button></div>}
          </section>

          <section className="quick-action-panel"><div><p className="eyebrow">FAST DAILY ENTRY</p><h2>Record the document before you release it.</h2><p>Use a routing template, enter the document number, and confirm the destination. The system keeps the complete chain of custody.</p></div><button className="primary-button" onClick={newDocument}><FilePlus2 size={18} /> Add routing record</button></section>
          <section className="dashboard-grid">
            <div className="panel"><div className="panel-heading"><h2>Latest routed documents</h2><button className="text-button" onClick={() => setView("routes")}>View all</button></div><RoutingTable documents={routingDocuments.slice(0, 7)} loading={loading} onOpen={(item) => setSelectedId(item.id)} /></div>
            <div className="panel"><div className="panel-heading"><h2>Recent activity</h2><button className="text-button" onClick={() => setView("activity")}>View all</button></div><ActivityList activities={activities.slice(0, 8)} /></div>
          </section>
        </div>}

        {view === "documents" && <div className="page-section"><section className="panel"><Filters search={search} setSearch={setSearch} typeFilter={typeFilter} setTypeFilter={setTypeFilter} statusFilter={statusFilter} setStatusFilter={setStatusFilter} onExport={exportDocuments} /><DocumentTable documents={filteredDocuments} loading={loading} onOpen={(item) => setSelectedId(item.id)} showOwner={isAdmin} userMap={userMap} requestCounts={requestCounts} /></section></div>}

        {view === "routes" && <div className="page-section"><section className="routing-explainer"><div><p className="eyebrow">CHAIN OF CUSTODY</p><h2>Each handoff keeps the exact date, time, person, and office.</h2><p>Open any record to add the next route or check the complete history.</p></div><Clock3 size={42} /></section><section className="panel"><Filters search={search} setSearch={setSearch} typeFilter={typeFilter} setTypeFilter={setTypeFilter} onExport={exportRoutes} /><RoutingTable documents={filteredRoutes} loading={loading} onOpen={(item) => setSelectedId(item.id)} showOwner={isAdmin} userMap={userMap} /></section></div>}

        {view === "alerts" && <div className="page-section"><section className="alert-summary-grid"><MiniMetric label="Missing" value={missing.length} /><MiniMetric label="No acknowledgment" value={unacknowledged.length} /><MiniMetric label="Over 3 days" value={stalled.length} /><MiniMetric label="Duplicate numbers" value={duplicates.length} /></section><section className="panel"><div className="panel-heading"><h2>Documents needing follow-up</h2></div>{alerts.length ? <div className="alert-card-grid">{alerts.map((item) => <button className="alert-card" key={item.id} onClick={() => setSelectedId(item.id)}><div className="alert-icon"><AlertTriangle size={20} /></div><div><strong>{item.type} {item.requestNo}</strong><span>Current: {item.currentHolder}</span><p>{normalizeStatus(item.status) === "missing" ? "Marked missing" : unacknowledged.some((route) => route.id === item.id) ? "No acknowledgment after one day" : stalled.some((route) => route.id === item.id) ? "Stayed with the current holder for over three days" : "Duplicate number"}</p></div></button>)}</div> : <div className="empty-panel success-empty">No routing exceptions detected.</div>}</section></div>}

        {view === "archive" && <div className="page-section"><section className="panel"><div className="panel-heading"><div><p className="eyebrow">SOFT DELETE</p><h2>Archived documents</h2></div><span>{archivedDocuments.length} record{archivedDocuments.length === 1 ? "" : "s"}</span></div><DocumentTable documents={archivedDocuments} loading={loading} onOpen={(item) => setSelectedId(item.id)} showOwner={isAdmin} userMap={userMap} requestCounts={{}} /></section></div>}

        {view === "activity" && <div className="page-section"><section className="panel"><div className="panel-heading"><div><p className="eyebrow">AUDIT TRAIL</p><h2>{isAdmin ? "System activity" : "My activity"}</h2></div></div><ActivityList activities={activities} full /></section></div>}

        {view === "messages" && <div className="page-section messages-section"><MessagesPage user={user} users={users} notify={notify} /></div>}

        {view === "users" && isAdmin && <div className="page-section"><section className="metric-grid user-metric-grid"><Metric label="Total accounts" value={users.length} note="Registered profiles" /><Metric label="Active" value={users.filter((item) => item.active).length} note="Can use the system" positive /><Metric label="Administrators" value={users.filter((item) => isAdminRole(item.role)).length} note="Full access" /><Metric label="Disabled" value={users.filter((item) => !item.active).length} note="Access blocked" alert={users.some((item) => !item.active)} /></section><section className="panel"><div className="user-toolbar"><div className="search-box"><Search size={18} /><input placeholder="Search name, department, position…" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} /></div><button className="primary-button" onClick={newUser}><UserPlus size={17} /> Create account</button></div><UserTable users={filteredUsers} currentUid={user.uid} documentCounts={documents.reduce<Record<string, number>>((acc, item) => { acc[item.ownerUid] = (acc[item.ownerUid] || 0) + 1; return acc; }, {})} onEdit={editUser} /></section></div>}

        {view === "profile" && <div className="page-section profile-page"><section className="panel profile-panel"><div className="profile-heading"><Avatar name={user.displayName} photoDataUrl={user.photoDataUrl} size="large" /><div><p className="eyebrow">USER PROFILE</p><h2>{user.displayName}</h2><span>{user.email}</span></div></div><ProfileForm profile={user} onSubmit={saveProfile} /></section></div>}
      </main>

      {view === "users" && isAdmin ? <button className="mobile-fab" onClick={newUser}><UserPlus size={22} /></button> : view !== "profile" && view !== "messages" && <button className="mobile-fab" onClick={newDocument}><FilePlus2 size={22} /></button>}
      <nav className={`mobile-nav ${isAdmin ? "mobile-nav-admin" : ""}`}><button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}><BarChart3 size={19} /><span>Home</span></button><button className={view === "documents" ? "active" : ""} onClick={() => setView("documents")}><ClipboardList size={19} /><span>Documents</span></button><button className={view === "routes" ? "active" : ""} onClick={() => setView("routes")}><Clock3 size={19} /><span>Routes</span></button><button className={view === "alerts" ? "active" : ""} onClick={() => setView("alerts")}><ShieldAlert size={19} /><span>Check</span></button><button className={view === "messages" ? "active" : ""} onClick={() => setView("messages")}><MessageCircle size={19} /><span>Messages{unreadMessages > 0 ? ` (${unreadMessages})` : ""}</span></button>{isAdmin && <button className={view === "users" ? "active" : ""} onClick={() => setView("users")}><Users size={19} /><span>Users</span></button>}</nav>

      {formOpen && <Modal title={editing ? "Edit document" : "Quick routing log"} onClose={() => { setFormOpen(false); setEditing(null); }} wide><DocumentForm document={editing} existingDocuments={documents.map((item) => ({ id: item.id, type: item.type, requestNo: item.requestNo }))} ownerOptions={isAdmin ? activeOwnerOptions : undefined} ownerUid={ownerUid} onOwnerChange={setOwnerUid} onSubmit={saveDocument} onCancel={() => { setFormOpen(false); setEditing(null); }} /></Modal>}
      {selected && <Modal title={`${selected.type} ${selected.requestNo}`} onClose={() => setSelectedId(null)} wide><DocumentDetails user={user} document={{ ...selected, ownerName: userMap.get(selected.ownerUid)?.displayName || selected.ownerName, ownerEmail: userMap.get(selected.ownerUid)?.email || selected.ownerEmail }} onEdit={() => { setSelectedId(null); editDocument(selected); }} notify={notify} /></Modal>}
      {userFormOpen && isAdmin && <Modal title={editingUser ? "Edit user account" : "Create user account"} onClose={() => { setUserFormOpen(false); setEditingUser(null); }}><UserForm profile={editingUser} isSelf={editingUser?.uid === user.uid} onSubmit={saveUserAccount} onCancel={() => { setUserFormOpen(false); setEditingUser(null); }} /></Modal>}
      {toast && <div className={`toast ${toast.error ? "toast-error" : ""}`}>{toast.message}</div>}
    </div>
  );
}

function Metric({ label, value, note, positive, alert }: { label: string; value: number; note: string; positive?: boolean; alert?: boolean }) {
  return <article className={`metric-card ${positive ? "metric-positive" : ""} ${alert ? "metric-alert" : ""}`}><span>{label}</span><strong>{value}</strong><p>{note}</p></article>;
}
function MiniMetric({ label, value }: { label: string; value: number }) { return <article className="mini-metric"><span>{label}</span><strong>{value}</strong></article>; }

function Filters({ search, setSearch, typeFilter, setTypeFilter, statusFilter, setStatusFilter, onExport }: {
  search: string; setSearch: (value: string) => void; typeFilter: string; setTypeFilter: (value: string) => void; statusFilter?: string; setStatusFilter?: (value: string) => void; onExport: () => void;
}) {
  return <div className="filter-row"><div className="search-box"><Search size={18} /><input placeholder="Search number, person, supplier, office…" value={search} onChange={(event) => setSearch(event.target.value)} /></div><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option>All</option>{DOCUMENT_TYPES.map((item) => <option key={item}>{item}</option>)}</select>{statusFilter !== undefined && setStatusFilter && <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All</option>{DOCUMENT_STATUSES.map((item) => <option key={item}>{item}</option>)}</select>}<button className="secondary-button" onClick={onExport}><Download size={16} /> Export CSV</button></div>;
}

function DocumentTable({ documents, loading, onOpen, showOwner = false, userMap, requestCounts }: {
  documents: DocumentRecord[]; loading: boolean; onOpen: (document: DocumentRecord) => void; showOwner?: boolean; userMap: Map<string, UserProfile>; requestCounts: Record<string, number>;
}) {
  if (loading) return <div className="loading-panel">Loading records…</div>;
  if (!documents.length) return <div className="empty-panel">No documents found. Use Quick log to add your first record.</div>;
  return <div className="table-wrap"><table className={showOwner ? "admin-document-table" : ""}><thead><tr><th>Document</th>{showOwner && <th>Recorded by</th>}<th>Routed date</th><th>Current holder</th><th>Requester / supplier</th><th>Amount / terms</th><th>Status</th></tr></thead><tbody>{documents.map((item) => { const owner = userMap.get(item.ownerUid); const duplicate = requestCounts[item.requestNo.trim().toLowerCase()] > 1; return <tr key={item.id} onClick={() => onOpen(item)}><td><strong>{item.type} {item.requestNo}</strong><span>{item.organization || "No organization"}{duplicate ? " · Duplicate" : ""}</span></td>{showOwner && <td><strong>{owner?.displayName || item.ownerName}</strong><span>{owner?.department || item.ownerEmail}</span></td>}<td>{formatDateTime(item.lastRoutedAt || item.createdAt)}</td><td><strong>{item.currentHolder}</strong><span>{item.lastRoutePurpose || ""}</span></td><td><strong>{item.purchasingEmployee || item.requestor || "—"}</strong><span>{item.supplier || ""}</span></td><td><strong>{item.amount ? formatCurrency(item.amount) : "—"}</strong><span>{item.paymentTerms || ""}</span></td><td><span className={statusClass(item.status)}>{item.status}</span></td></tr>; })}</tbody></table></div>;
}

function RoutingTable({ documents, loading, onOpen, showOwner = false, userMap = new Map() }: {
  documents: DocumentRecord[]; loading: boolean; onOpen: (document: DocumentRecord) => void; showOwner?: boolean; userMap?: Map<string, UserProfile>;
}) {
  if (loading) return <div className="loading-panel">Loading routing history…</div>;
  if (!documents.length) return <div className="empty-panel">No routed document found.</div>;
  return <div className="table-wrap"><table className="routing-log-table"><thead><tr><th>Document</th>{showOwner && <th>Recorded by</th>}<th>Date / time</th><th>From</th><th>Routed to / current holder</th><th>Purpose</th><th>Acknowledgment</th></tr></thead><tbody>{documents.map((item) => { const owner = userMap.get(item.ownerUid); return <tr key={item.id} onClick={() => onOpen(item)}><td><strong>{item.type} {item.requestNo}</strong><span>{item.organization || ""}</span></td>{showOwner && <td><strong>{owner?.displayName || item.ownerName}</strong><span>{owner?.position || owner?.department}</span></td>}<td>{formatDateTime(item.lastRoutedAt || item.createdAt)}</td><td>{item.lastFromOffice || "Student Assistant / Records"}</td><td><strong>{item.lastToOffice || item.currentHolder}</strong><span>Current: {item.currentHolder}</span></td><td>{item.lastRoutePurpose || "For review"}</td><td>{item.lastReceivedBy ? <><strong>{item.lastReceivedBy}</strong><span>{formatDateTime(item.lastReceivedAt || "")}</span></> : <span className="table-alert">Pending acknowledgment</span>}</td></tr>; })}</tbody></table></div>;
}

function UserTable({ users, currentUid, documentCounts, onEdit }: { users: UserProfile[]; currentUid: string; documentCounts: Record<string, number>; onEdit: (profile: UserProfile) => void }) {
  if (!users.length) return <div className="empty-panel">No user accounts found.</div>;
  return <div className="table-wrap"><table className="users-table"><thead><tr><th>User</th><th>Department / position</th><th>Role</th><th>Status</th><th>Records</th><th>Action</th></tr></thead><tbody>{users.map((profile) => <tr key={profile.uid}><td><div className="table-user"><Avatar name={profile.displayName} photoDataUrl={profile.photoDataUrl} size="small" /><div><strong>{profile.displayName}{profile.uid === currentUid ? " (You)" : ""}</strong><span>{profile.email}</span></div></div></td><td><strong>{profile.department || "Not assigned"}</strong><span>{profile.position || ""}</span></td><td><span className={`role-pill role-${isAdminRole(profile.role) ? "admin" : "staff"}`}>{isAdminRole(profile.role) ? "Administrator" : "Staff"}</span></td><td><span className={`account-status ${profile.active ? "account-active" : "account-disabled"}`}>{profile.active ? "Active" : "Disabled"}</span></td><td>{documentCounts[profile.uid] || 0}</td><td><button className="secondary-button compact-button" onClick={() => onEdit(profile)}><UserCog size={15} /> Manage</button></td></tr>)}</tbody></table></div>;
}

function ActivityList({ activities, full = false }: { activities: ActivityRecord[]; full?: boolean }) {
  if (!activities.length) return <div className="empty-panel">No activity recorded yet.</div>;
  return <div className={full ? "activity-list activity-list-full" : "activity-list"}>{activities.map((item) => <article key={item.id} className="activity-item"><div className="activity-icon"><History size={16} /></div><div><strong>{item.summary}</strong><span>{item.actorName || item.actorEmail} · {formatDateTime(item.createdAt)}</span>{item.documentLabel && <small>{item.documentLabel}</small>}</div><span className="activity-action">{item.action.replaceAll("_", " ")}</span></article>)}</div>;
}
