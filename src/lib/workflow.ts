import { DocumentRecord, DocumentType } from "./types";

export const ORGANIZATIONS = [
  "SISC",
  "TREX",
  "Tropical Palms",
  "ASAT",
  "ACTS",
  "Other",
] as const;

export const DEPARTMENTS = [
  "Admin Department",
  "Budget Office",
  "Treasury",
  "Accounting",
  "Audit Department",
  "Purchasing",
  "AMD / Receiving",
  "Supplier / Vendor",
  "Student Assistant / Records",
] as const;

export const ROUTE_CONTACTS = [
  "Ms. Jorge Balela — Admin / Budget Owner",
  "Sir Marc Marquez — Treasury / Accounting",
  "Ms. Lorie — Accounting / Treasury (Non-SISC)",
  "Ms. Lorie — Final Signatory",
  "Ms. Trixie Araneta — Audit Department",
  "Dr. Jo — Final Signatory",
  "AMD — Receiving Department",
  "Supplier / Vendor",
  "Student Assistant / Records",
] as const;

export const PAYMENT_TERMS = [
  "30 days",
  "15 days",
  "COD",
  "50% FP / 50% DP",
  "Other",
] as const;

export const ROUTE_PURPOSES = [
  "First signature / budget owner approval",
  "Treasury / accounting approval",
  "Audit review",
  "Final signature / approval",
  "Forwarded to supplier",
  "Product receiving / AMD acknowledgment",
  "Returned for correction",
  "For filing / records",
] as const;

export interface RoutingTemplate {
  id: string;
  label: string;
  type: DocumentType;
  organization: string;
  destination: string;
  purpose: string;
}

export const ROUTING_TEMPLATES: RoutingTemplate[] = [
  {
    id: "prf-sisc",
    label: "PRF — SISC",
    type: "PRF",
    organization: "SISC",
    destination: "Ms. Jorge Balela — Admin / Budget Owner",
    purpose: "First signature / budget owner approval",
  },
  {
    id: "prf-non-sisc",
    label: "PRF — Non-SISC",
    type: "PRF",
    organization: "Other",
    destination: "Ms. Jorge Balela — Admin / Budget Owner",
    purpose: "First signature / budget owner approval",
  },
  {
    id: "srf-sisc",
    label: "SRF — SISC",
    type: "SRF",
    organization: "SISC",
    destination: "Ms. Jorge Balela — Admin / Budget Owner",
    purpose: "First signature / budget owner approval",
  },
  {
    id: "srf-non-sisc",
    label: "SRF — Non-SISC",
    type: "SRF",
    organization: "Other",
    destination: "Ms. Jorge Balela — Admin / Budget Owner",
    purpose: "First signature / budget owner approval",
  },
  {
    id: "crf-sisc",
    label: "CRF — SISC / SO / 10 series",
    type: "CRF",
    organization: "SISC",
    destination: "Sir Marc Marquez — Treasury / Accounting",
    purpose: "Treasury / accounting approval",
  },
  {
    id: "crf-non-sisc",
    label: "CRF — TREX / Tropical Palms / ASAT / ACTS / Other",
    type: "CRF",
    organization: "Other",
    destination: "Ms. Lorie — Accounting / Treasury (Non-SISC)",
    purpose: "Treasury / accounting approval",
  },
  {
    id: "po-amd",
    label: "PO — Route to AMD",
    type: "PO",
    organization: "SISC",
    destination: "AMD — Receiving Department",
    purpose: "Product receiving / AMD acknowledgment",
  },
];

export function isSiscDocument(
  organization: string,
  requestNo: string
): boolean {
  const normalizedOrg = organization.trim().toLowerCase();
  const normalizedNo = requestNo.trim().toUpperCase();

  return (
    normalizedOrg === "sisc" ||
    normalizedNo.startsWith("SO") ||
    normalizedNo.startsWith("10")
  );
}

export function suggestedInitialDestination(
  type: DocumentType,
  organization: string,
  requestNo: string
): string {
  if (type === "PO") {
    return "AMD — Receiving Department";
  }

  if (type === "CRF") {
    return isSiscDocument(organization, requestNo)
      ? "Sir Marc Marquez — Treasury / Accounting"
      : "Ms. Lorie — Accounting / Treasury (Non-SISC)";
  }

  return "Ms. Jorge Balela — Admin / Budget Owner";
}

export function suggestedPurpose(destination: string): string {
  const value = destination.toLowerCase();

  if (value.includes("jorge")) {
    return "First signature / budget owner approval";
  }

  if (value.includes("marc")) {
    return "Treasury / accounting approval";
  }

  if (value.includes("trixie")) {
    return "Audit review";
  }

  if (
    value.includes("lorie") &&
    value.includes("accounting")
  ) {
    return "Treasury / accounting approval";
  }

  if (
    value.includes("dr. jo") ||
    (value.includes("lorie") && value.includes("final"))
  ) {
    return "Final signature / approval";
  }

  if (value.includes("supplier")) {
    return "Forwarded to supplier";
  }

  if (value.includes("amd")) {
    return "Product receiving / AMD acknowledgment";
  }

  return "For review / signature";
}

export function nextRouteSuggestions(
  document: DocumentRecord
): string[] {
  const current = (
    document.currentHolder ||
    document.lastToOffice ||
    ""
  ).toLowerCase();

  const org = document.organization || "";

  if (document.type === "PO") {
    return ["AMD — Receiving Department"];
  }

  if (document.type === "CRF") {
    return isSiscDocument(org, document.requestNo)
      ? [
          "Sir Marc Marquez — Treasury / Accounting",
          "Ms. Lorie — Final Signatory",
        ]
      : [
          "Ms. Lorie — Accounting / Treasury (Non-SISC)",
          "Ms. Lorie — Final Signatory",
        ];
  }

  if (current.includes("jorge")) {
    return isSiscDocument(org, document.requestNo)
      ? ["Sir Marc Marquez — Treasury / Accounting"]
      : ["Ms. Lorie — Accounting / Treasury (Non-SISC)"];
  }

  if (
    current.includes("marc") ||
    (current.includes("lorie") &&
      current.includes("accounting"))
  ) {
    return ["Ms. Trixie Araneta — Audit Department"];
  }

  if (current.includes("trixie")) {
    return [
      "Ms. Lorie — Final Signatory",
      "Dr. Jo — Final Signatory",
    ];
  }

  return [
    "Ms. Jorge Balela — Admin / Budget Owner",
    isSiscDocument(org, document.requestNo)
      ? "Sir Marc Marquez — Treasury / Accounting"
      : "Ms. Lorie — Accounting / Treasury (Non-SISC)",
    "Ms. Trixie Araneta — Audit Department",
    "Ms. Lorie — Final Signatory",
    "Dr. Jo — Final Signatory",
  ];
}
