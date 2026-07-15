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
}

export type DocumentInput = Omit<
  DocumentRecord,
  "id" | "trackingId" | "ownerUid" | "ownerName" | "ownerEmail" | "routeCount" | "createdAt" | "updatedAt"
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
  remarks: string;
  createdAt: string;
  createdByUid: string;
  createdByName: string;
}

export type RoutingInput = Omit<RoutingRecord, "id" | "documentId" | "createdAt" | "createdByUid" | "createdByName">;

export interface DocumentSubmission {
  document: DocumentInput;
  initialRoute: RoutingInput;
}

export interface SessionUser extends UserProfile {
  isDemo?: boolean;
}
