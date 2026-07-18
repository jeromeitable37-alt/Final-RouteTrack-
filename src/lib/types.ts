export const DOCUMENT_TYPES = ["PRF", "SRF", "CRF", "PO"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_STATUSES = [
  "For Routing",
  "In Transit",
  "Received",
  "Under Review",
  "For Approval",
  "Returned for Correction",
  "Completed",
  "Cancelled",
  "Missing",
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const COPY_TYPES = ["Original", "Photocopy", "Scanned Copy"] as const;
export type CopyType = (typeof COPY_TYPES)[number];

export const MOVEMENT_STATUSES = ["Routed", "Received", "Returned", "On Hold"] as const;
export type MovementStatus = (typeof MOVEMENT_STATUSES)[number];

export const USER_ROLES = ["admin", "staff"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export type RouteEventType = "route" | "acknowledgment" | "status";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  department: string;
  position?: string;
  phone?: string;
  photoDataUrl?: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ManagedUserInput {
  displayName: string;
  email: string;
  department: string;
  position?: string;
  phone?: string;
  photoDataUrl?: string;
  role: UserRole;
  active: boolean;
  password?: string;
}

export interface DocumentRecord {
  id: string;
  trackingId: string;
  ownerUid: string;
  ownerName: string;
  ownerEmail: string;
  type: DocumentType;
  requestNo: string;
  dateRequested: string;
  requestingDepartment: string;
  requestor: string;
  subjectPurpose: string;
  amount: number;
  dateLogged: string;
  currentHolder: string;
  status: DocumentStatus;
  dueDate: string;
  copyType: CopyType;
  physicalLocation: string;
  remarks: string;
  routeCount: number;
  createdAt: string;
  updatedAt: string;
  organization?: string;
  supplier?: string;
  purchasingEmployee?: string;
  dateForwardedSupplier?: string;
  paymentTerms?: string;
  itemsDescription?: string;
  lastRoutedAt?: string;
  lastFromOffice?: string;
  lastToOffice?: string;
  lastRoutePurpose?: string;
  lastReceivedBy?: string;
  lastReceivedAt?: string;
  lastMovementStatus?: MovementStatus;
  lastRouteEncodedBy?: string;
  lastProofReference?: string;
  routeSearchText?: string;
  completedAt?: string;
  archivedAt?: string;
  archivedBy?: string;
  lastFollowUpAt?: string;
  nextFollowUpAt?: string;
  followUpCount?: number;
  slaDays?: number;
}

export type DocumentInput = Omit<
  DocumentRecord,
  | "id"
  | "trackingId"
  | "ownerUid"
  | "ownerName"
  | "ownerEmail"
  | "routeCount"
  | "createdAt"
  | "updatedAt"
  | "routeSearchText"
  | "completedAt"
  | "archivedAt"
  | "archivedBy"
>;

export interface RoutingRecord {
  id: string;
  documentId: string;
  dateTimeRouted: string;
  fromOffice: string;
  toOffice: string;
  actionPurpose: string;
  receivedBy: string;
  dateTimeReceived: string;
  movementStatus: MovementStatus;
  proofReference: string;
  proofPhotoDataUrl?: string;
  receiverConfirmation?: string;
  eventType?: RouteEventType;
  remarks: string;
  createdAt: string;
  createdByUid: string;
  createdByName: string;
}

export type RoutingInput = Omit<
  RoutingRecord,
  "id" | "documentId" | "createdAt" | "createdByUid" | "createdByName"
>;

export interface DocumentSubmission {
  document: DocumentInput;
  initialRoute: RoutingInput;
}

export interface ActivityRecord {
  id: string;
  actorUid: string;
  actorName: string;
  actorEmail: string;
  action: string;
  summary: string;
  documentId?: string;
  documentLabel?: string;
  createdAt: string;
}


export interface ConversationRecord {
  id: string;
  participantUids: string[];
  participantNames: Record<string, string>;
  participantEmails: Record<string, string>;
  unreadCounts: Record<string, number>;
  lastMessage: string;
  lastSenderUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface DirectMessageRecord {
  id: string;
  conversationId: string;
  senderUid: string;
  senderName: string;
  recipientUid: string;
  text: string;
  createdAt: string;
  readAt: string;
}

export interface SessionUser extends UserProfile {
  isDemo?: boolean;
}


export const FOLLOW_UP_METHODS = ["Personal", "Call", "Message", "Email"] as const;
export type FollowUpMethod = (typeof FOLLOW_UP_METHODS)[number];

export interface FollowUpRecord {
  id: string;
  documentId: string;
  contactedPerson: string;
  method: FollowUpMethod;
  result: string;
  nextFollowUpAt: string;
  notes: string;
  createdAt: string;
  createdByUid: string;
  createdByName: string;
}

export interface SupportingLinkRecord {
  id: string;
  documentId: string;
  title: string;
  url: string;
  notes: string;
  createdAt: string;
  createdByUid: string;
  createdByName: string;
}

export interface HandoverRecord {
  id: string;
  ownerUid: string;
  ownerName: string;
  shiftDate: string;
  summary: string;
  documentIds: string[];
  createdAt: string;
}

export interface LoginActivityRecord {
  id: string;
  userUid: string;
  userName: string;
  userEmail: string;
  userAgent: string;
  createdAt: string;
}
