"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  DOCUMENT_TYPES,
  DocumentInput,
  DocumentRecord,
  DocumentSubmission,
  UserProfile,
} from "@/lib/types";
import { nowLocalInput, todayInput } from "@/lib/utils";
import {
  ORGANIZATIONS,
  PAYMENT_TERMS,
  ROUTE_CONTACTS,
  ROUTE_PURPOSES,
  suggestedInitialDestination,
  suggestedPurpose,
} from "@/lib/workflow";
import { SmartInput } from "./SmartInput";

const STATUS_OPTIONS = [
  "For Routing",
  "In Transit",
  "Received",
  "Under Review",
  "For Approval",
  "Returned for Correction",
  "Completed",
  "Cancelled",
  "Missing",
];

const PURCHASING_EMPLOYEES = [
  "Leah Buhay",
  "JC Campit",
  "EJ Aliermo",
  "Ruel Balanlayos",
  "Jessa Ariscon",
];

const SUPPLIERS = [
  "Maximum Solutions Corporation",
  "Amalgamated Specialties Corporation",
  "Times Trading Co., Inc.",
  "Jarm Printing Press",
  "Oray Copier Solutions",
  "Crown Supply Corporation",
  "Creative Juice Digital Printing",
  "Supertank Internatioanl Company",
  "REX Bookstore, Inc.",
  "Columbia Technologies, Inc.",
  "Microsmith Technology System,Inc.",
  "Leonard Prints Inc.",
  "Farm Printing Press",
  "Palces Manufacturing, Inc.",
  "National Bookstore, Inc.",
  "NTDC 888 Global Enterprise",
  "C & E Publishing Inc.",
  "Gift Republic, Inc.",
  "Tropical Palms Fashion House, Inc.",
  "Progressive Medical Corporation",
  "Waller International, Inc.",
  "Contrade Integrated Depot",
  "iEquity Technologies Corp.",
  "Print Depot Inc.",
  "Rivchem Enterprises",
  "Inkonvert Enterprises",
  "Abacus Book & Card Corp.",
  "Majesty Builders & Electrical Supply",
  "Alpha-Cored Technology Systems, Inc.",
  "Crosspoint Paper, Inc.",
  "JAC Aluminum and Glass Supply and Services",
  "Manila Rubber Corporation",
  "National Bookstore",
  "Soap King, Inc.",
  "Chemtrust Global Market, Inc.",
  "Officelandia Enterprises, Inc.",
  "Philippine Blue Cross Biotech Corporation",
  "Express Cards Enterprises Co.",
  "Sprintec Printing Press, Inc.",
  "EIG Metal Engravers",
  "Wisechoice Cleaning Supplies and Trading Corp.",
  "Polaris Prime Air Tech Corporation",
  "Luminaire Printing And Publishing Corp.",
  "Trojan Computer Forms Mfg. Corp.",
  "Oxychem",
  "Commerce Asia, Inc.",
  "MMP Friendly Gift Ideas Store",
  "Sert Technology Inc.",
  "Hospeco Philippines, Inc.",
  "Atlas Superflags",
  "Net Ad IT Solutions",
  "Arkin Hardware",
  "Roavsan General Merchandise",
  "PNB Credit Card",
  "Brown Movement for Cultural Advancement, Inc.",
  "Ahrcel's Gift Shop",
  "Raynard's Enterprises",
  "Paper Tree Marketing Group, Inc.",
  "Marguerita Maria Nina I. Kanapi",
  "Amazon",
  "Belview Co., Inc.",
  "Awardextremes, Inc.",
  "Abenson Ventures, Inc.",
  "JC Campit And Michael Berza",
  "Arkwood Plus Fine Furniture",
  "Sparklight Marketing Incorporated",
  "Data Computer Forms, Inc.",
  "DKL Laboratory Supplies",
  "One Supply",
  "Polaris Integrated Industries, Inc.",
  "Falcon Waterfree Philippines, Inc.",
  "Ergo Contracts Phil., Inc.",
  "Hytec Power, Inc.",
  "Lordfel Marketing",
  "Forefront Book Co., Inc.",
  "Booktrens Enterprises",
  "EESM Bookstore",
  "Marrbont Corporation",
  "Ronald Personalized Fashion Specialist",
  "Beyond Global Multiales Corp.",
  "Printing Shop PrintPilipinas.com",
  "Goldlink Indsutrial Sales",
  "Mostaco Printing",
  "EA Intertrade General Merchandising, Inc.",
  "World Magazine Exchange Marketing Corp.",
  "Chronos Athletics Shop",
  "Circuitrocks Electronic Store",
  "V.M Industries Corp.",
  "ADBM Lightning Equipment Trading",
  "Primeline Products Philippines, Inc.",
  "Patagonian Enterprises",
  "Dynamics Electrical Supply and Hardware",
  "I-Stop Graphics and Business Center",
  "RSAZ Corporation",
  "JLY Garment Trading",
  "Alpha Steel Office and Home Furnishing Company",
  "Zariah's Non-Specialized Wholesale Trading",
  "ULTRA PETRONNE INTERIOR SUPPLY CORPORATION",
  "DOOPLO ADVERTISING",
  "Abiva Publishing House, Inc.",
  "CD Books International, Inc.",
  "Javammp Printing Services",
  "BIG LEAGUE SPORTS WEAR SHOP. INC.",
  "Shelves and Cups Book Store",
  "Litera Trading Inc.",
  "Northwind Communications and Electronics",
  "Philippine Chinese Education Research Center Inc.",
  "Ma Espiritu Tiles Trading",
  "Bobman Trading",
  "Colent Marketing Philippines, Inc.",
  "Elle Tech and Trend Office Furniture and Interiors",
  "Montesan Enterprises",
  "Ace Hardware",
  "Tadeos Scientific Industries OPC",
  "Velca Equipment And Engineered",
  "Nathanizastef Corporate Giveaways Trading",
  "Amson Pharmaceuticals",
  "Mostaco Marketing",
  "COMPUTECHNOLOGIES CORP.",
  "Multiflex RNC Philippines inc.",
  "Wilcon Depot Inc.",
  "ARCHITRAVE TRADING",
  "4David's Book Trading",
  "Eprayim Granite and Marble Inc.",
  "888 Tile Phil Corp",
  "YKP General Merchandise",
  "ECOSHIFT CORPORATION",
  "Asahl Design Centre Inc.",
  "Golden Advance Marketing",
  "Jassen Harris  Industries Corp.",
  "Almagated Specialties Corp.",
  "Manos Allied Corporation",
  "Philippine Educational Theater Association, Inc.",
  "Bookquick Marketing",
  "ASTC Electronics Services And Supply",
  "O&J Global Trading",
  "Gleam Multimedia  Post-Production SER",
  "JMD International Corp",
  "JW Summit Group Inc.",
  "WS Pacific Publications Inc.",
  "Eco Hygiene Institutional Sales Corp.",
  "Barcaman Couture Corporation",
  "Office Warehouse inc.",
];

function baseDocument(): DocumentInput {
  return {
    type: "PRF",
    requestNo: "",
    dateRequested: todayInput(),
    requestingDepartment: "",
    requestor: "",
    subjectPurpose: "",
    amount: 0,
    dateLogged: todayInput(),
    currentHolder: "Ms. Jorge Balela — Admin / Budget Owner",
    status: "In Transit",
    dueDate: "",
    copyType: "Original",
    physicalLocation: "",
    remarks: "",
    organization: "SISC",
    supplier: "",
    purchasingEmployee: "",
    dateForwardedSupplier: todayInput(),
    paymentTerms: "",
    itemsDescription: "",
  };
}

export function DocumentForm({
  document,
  existingDocuments,
  ownerOptions,
  ownerUid,
  onOwnerChange,
  onSubmit,
  onCancel,
}: {
  document?: DocumentRecord | null;
  existingDocuments: Pick<
    DocumentRecord,
    "id" | "type" | "requestNo"
  >[];
  ownerOptions?: UserProfile[];
  ownerUid?: string;
  onOwnerChange?: (uid: string) => void;
  onSubmit: (submission: DocumentSubmission) => Promise<void>;
  onCancel: () => void;
}) {
  const initial = document
    ? ({
        type: document.type,
        requestNo: document.requestNo,
        dateRequested: document.dateRequested,
        requestingDepartment: document.requestingDepartment,
        requestor: document.requestor,
        subjectPurpose: document.subjectPurpose,
        amount: document.amount,
        dateLogged: document.dateLogged,
        currentHolder: document.currentHolder,
        status: document.status,
        dueDate: document.dueDate,
        copyType: document.copyType,
        physicalLocation: document.physicalLocation,
        remarks: document.remarks,
        organization: document.organization || "",
        supplier: document.supplier || "",
        purchasingEmployee:
          document.purchasingEmployee || document.requestor || "",
        dateForwardedSupplier:
          document.dateForwardedSupplier || document.dateRequested,
        paymentTerms: document.paymentTerms || "",
        itemsDescription:
          document.itemsDescription || document.subjectPurpose || "",
      } satisfies DocumentInput)
    : baseDocument();

  const [form, setForm] = useState<DocumentInput>(initial);

  const [dateTimeRouted, setDateTimeRouted] = useState(
    document?.lastRoutedAt || nowLocalInput()
  );

  const [routeTo, setRouteTo] = useState(
    document?.currentHolder ||
      suggestedInitialDestination(
        initial.type,
        initial.organization || "",
        initial.requestNo
      )
  );

  const [routePurpose, setRoutePurpose] = useState(
    document?.lastRoutePurpose || suggestedPurpose(routeTo)
  );

  const [routeTouched, setRouteTouched] = useState(Boolean(document));
  const [showMore, setShowMore] = useState(Boolean(document));
  const [saving, setSaving] = useState(false);

  const normalized = form.requestNo.trim().toLowerCase();

  const duplicate =
    Boolean(normalized) &&
    existingDocuments.some(
      (item) =>
        item.id !== document?.id &&
        item.type === form.type &&
        item.requestNo.trim().toLowerCase() === normalized
    );

  const isCrf = form.type === "CRF";
  const isPo = form.type === "PO";

  const isRequestForm =
    form.type === "PRF" || form.type === "SRF";

  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    if (!form.requestNo.trim()) {
      errors.push(`${form.type} number`);
    }

    if (!dateTimeRouted) {
      errors.push("date and time routed");
    }

    if (!routeTo.trim()) {
      errors.push("route destination");
    }

    if (isCrf) {
      if (!form.purchasingEmployee?.trim()) {
        errors.push("purchasing employee / requisitioner");
      }

      if (!form.dateRequested) {
        errors.push("CRF date");
      }

      if (!(Number(form.amount) > 0)) {
        errors.push("amount greater than zero");
      }

      if (!form.supplier?.trim()) {
        errors.push("supplier");
      }

      if (!form.itemsDescription?.trim()) {
        errors.push("description / items");
      }
    }

    if (isPo) {
      if (!form.dateForwardedSupplier) {
        errors.push("date forwarded to supplier");
      }

      if (!form.supplier?.trim()) {
        errors.push("supplier");
      }

      if (!form.paymentTerms?.trim()) {
        errors.push("payment terms");
      }

      if (!form.itemsDescription?.trim()) {
        errors.push("purchased product / items");
      }
    }

    return errors;
  }, [form, dateTimeRouted, routeTo, isCrf, isPo]);

  const requiredReady = validationErrors.length === 0;

  function update<K extends keyof DocumentInput>(
    key: K,
    value: DocumentInput[K]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function applyAutoRoute(next: Partial<DocumentInput>) {
    if (routeTouched) {
      return;
    }

    const type = (next.type || form.type) as DocumentInput["type"];

    const organization = String(
      next.organization ?? form.organization ?? ""
    );

    const requestNo = String(
      next.requestNo ?? form.requestNo
    );

    const destination = suggestedInitialDestination(
      type,
      organization,
      requestNo
    );

    setRouteTo(destination);
    setRoutePurpose(suggestedPurpose(destination));
  }

  function changeType(type: DocumentInput["type"]) {
    const next: DocumentInput = {
      ...form,
      type,
    };

    if (type === "PO") {
      next.status = "In Transit";
    }

    setForm(next);
    applyAutoRoute({ type });
  }

  function changeRequestNo(requestNo: string) {
    update("requestNo", requestNo);
    applyAutoRoute({ requestNo });
  }

  function changeOrganization(organization: string) {
    update("organization", organization);
    applyAutoRoute({ organization });
  }

  function changeRouteTo(value: string) {
    setRouteTouched(true);
    setRouteTo(value);
    setRoutePurpose(suggestedPurpose(value));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (duplicate || !requiredReady) {
      return;
    }

    setSaving(true);

    try {
      const description = String(
        form.itemsDescription ||
          form.subjectPurpose ||
          `${form.type} ${form.requestNo}`
      ).trim();

      const requestor = String(
        form.purchasingEmployee ||
          form.requestor ||
          ""
      ).trim();

      const documentInput: DocumentInput = {
        ...form,
        requestor,
        purchasingEmployee: requestor,
        subjectPurpose: description,
        itemsDescription: description,
        dateLogged: dateTimeRouted.slice(0, 10),
        currentHolder: routeTo.trim(),

        // New documents automatically start as In Transit.
        // Existing documents keep the selected status.
        status: document ? form.status : "In Transit",
      };

      await onSubmit({
        document: documentInput,
        initialRoute: {
          dateTimeRouted,
          fromOffice: "Student Assistant / Records",
          toOffice: routeTo.trim(),
          actionPurpose:
            routePurpose.trim() || suggestedPurpose(routeTo),
          receivedBy: "",
          dateTimeReceived: "",
          movementStatus: "Routed",
          proofReference: "",
          remarks: form.remarks,
        },
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="document-form quick-log-form"
      onSubmit={submit}
    >
      <section className="quick-form-intro">
        <div>
          <p className="eyebrow">QUICK ROUTING ENTRY</p>

          <h3>
            {document
              ? "Update document information"
              : "Record the document before releasing it"}
          </h3>
        </div>

        <span>
          Only the fields marked required must be completed.
        </span>
      </section>

      <div className="form-grid">
        {ownerOptions && ownerOptions.length > 0 && (
          <label className="span-2">
            Record owner

            <select
              value={ownerUid}
              onChange={(event) =>
                onOwnerChange?.(event.target.value)
              }
              disabled={Boolean(document)}
            >
              {ownerOptions.map((owner) => (
                <option
                  key={owner.uid}
                  value={owner.uid}
                >
                  {owner.displayName} —{" "}
                  {owner.department || owner.email}
                </option>
              ))}
            </select>
          </label>
        )}

        <label>
          Document type

          <select
            value={form.type}
            onChange={(event) =>
              changeType(
                event.target.value as DocumentInput["type"]
              )
            }
          >
            {DOCUMENT_TYPES.map((item) => (
              <option
                key={item}
                value={item}
              >
                {item}
              </option>
            ))}
          </select>
        </label>

        <label>
          {form.type} number

          <input
            value={form.requestNo}
            onChange={(event) =>
              changeRequestNo(event.target.value)
            }
            placeholder={`Enter ${form.type} number`}
            required
          />

          {duplicate && (
            <span className="field-error">
              This document number already exists.
            </span>
          )}
        </label>

        <label>
          Date and time routed

          <input
            type="datetime-local"
            value={dateTimeRouted}
            onChange={(event) =>
              setDateTimeRouted(event.target.value)
            }
            required
          />
        </label>

        <SmartInput
          label="Organization / company"
          value={form.organization || ""}
          options={ORGANIZATIONS}
          onChange={changeOrganization}
          placeholder="Choose or type organization"
        />

        <SmartInput
          className="span-2"
          label={
            document
              ? "Current holder / office"
              : "Route to person / department"
          }
          value={routeTo}
          options={ROUTE_CONTACTS}
          onChange={changeRouteTo}
          placeholder="Choose a common person or type another name"
          required
          help="You can select a suggestion or type any other person or department."
        />

        {!document && (
          <SmartInput
            className="span-2"
            label="Purpose of routing"
            value={routePurpose}
            options={ROUTE_PURPOSES}
            onChange={setRoutePurpose}
            placeholder="Choose or type the routing purpose"
            required
          />
        )}

        {isCrf && (
          <>
            <SmartInput
              label="Purchasing employee / requisitioner"
              value={form.purchasingEmployee || ""}
              options={PURCHASING_EMPLOYEES}
              onChange={(value) =>
                update("purchasingEmployee", value)
              }
              placeholder="Choose or type an employee"
              required
              help="Select an employee from the list or type another name."
            />

            <label>
              CRF date

              <input
                type="date"
                value={form.dateRequested}
                onChange={(event) =>
                  update(
                    "dateRequested",
                    event.target.value
                  )
                }
                required
              />
            </label>

            <label>
              Amount

              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount || ""}
                onChange={(event) =>
                  update(
                    "amount",
                    Number(event.target.value)
                  )
                }
                required
              />
            </label>

            <SmartInput
              label="Supplier"
              value={form.supplier || ""}
              options={SUPPLIERS}
              onChange={(value) =>
                update("supplier", value)
              }
              placeholder="Choose or type a supplier"
              required
              help="Select a supplier from the list or type another supplier."
            />

            <label className="span-2">
              Description / items

              <textarea
                rows={3}
                value={form.itemsDescription || ""}
                onChange={(event) =>
                  update(
                    "itemsDescription",
                    event.target.value
                  )
                }
                required
              />
            </label>
          </>
        )}

        {isPo && (
          <>
            <label>
              Date forwarded to supplier

              <input
                type="date"
                value={form.dateForwardedSupplier || ""}
                onChange={(event) =>
                  update(
                    "dateForwardedSupplier",
                    event.target.value
                  )
                }
                required
              />
            </label>

            <SmartInput
              label="Terms"
              value={form.paymentTerms || ""}
              options={PAYMENT_TERMS}
              onChange={(paymentTerms) =>
                update("paymentTerms", paymentTerms)
              }
              placeholder="Choose or type terms"
              required
            />

            <SmartInput
              label="Supplier"
              value={form.supplier || ""}
              options={SUPPLIERS}
              onChange={(value) =>
                update("supplier", value)
              }
              placeholder="Choose or type a supplier"
              required
              help="Select a supplier from the list or type another supplier."
            />

            <label>
              Purchasing employee

              <input
                value={form.purchasingEmployee || ""}
                onChange={(event) =>
                  update(
                    "purchasingEmployee",
                    event.target.value
                  )
                }
              />
            </label>

            <label className="span-2">
              Purchased product / items

              <textarea
                rows={3}
                value={form.itemsDescription || ""}
                onChange={(event) =>
                  update(
                    "itemsDescription",
                    event.target.value
                  )
                }
                required
              />
            </label>
          </>
        )}
      </div>

      {isRequestForm && (
        <div className="optional-toggle">
          <button
            type="button"
            className="text-button"
            onClick={() =>
              setShowMore((current) => !current)
            }
          >
            {showMore
              ? "Hide optional details"
              : "Add optional request details"}
          </button>
        </div>
      )}

      {(showMore || document) && isRequestForm && (
        <div className="form-grid optional-fields">
          <label>
            Requested by / employee

            <input
              value={form.purchasingEmployee || ""}
              onChange={(event) =>
                update(
                  "purchasingEmployee",
                  event.target.value
                )
              }
            />
          </label>

          <label>
            Document date

            <input
              type="date"
              value={form.dateRequested}
              onChange={(event) =>
                update(
                  "dateRequested",
                  event.target.value
                )
              }
            />
          </label>

          <label>
            Amount

            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount || ""}
              onChange={(event) =>
                update(
                  "amount",
                  Number(event.target.value)
                )
              }
            />
          </label>

          <SmartInput
            label="Supplier"
            value={form.supplier || ""}
            options={SUPPLIERS}
            onChange={(value) =>
              update("supplier", value)
            }
            placeholder="Choose or type a supplier"
            help="Select a supplier from the list or type another supplier."
          />

          <label className="span-2">
            Description / items

            <textarea
              rows={2}
              value={form.itemsDescription || ""}
              onChange={(event) =>
                update(
                  "itemsDescription",
                  event.target.value
                )
              }
            />
          </label>
        </div>
      )}

      <div className="form-grid form-bottom-fields">
        {document && (
          <label className="span-2">
            Document status

            <select
              value={form.status}
              onChange={(event) =>
                update(
                  "status",
                  event.target
                    .value as DocumentInput["status"]
                )
              }
            >
              {STATUS_OPTIONS.map((status) => (
                <option
                  key={status}
                  value={status}
                >
                  {status}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="span-2">
          Remarks

          <textarea
            rows={2}
            value={form.remarks}
            onChange={(event) =>
              update("remarks", event.target.value)
            }
            placeholder="Optional notes"
          />
        </label>
      </div>

      {(duplicate || validationErrors.length > 0) && (
        <div
          className="form-validation-summary"
          role="alert"
        >
          {duplicate ? (
            <strong>
              A {form.type} with this number already exists.
            </strong>
          ) : (
            <>
              <strong>
                Complete these fields before saving:
              </strong>

              <span>
                {validationErrors.join(", ")}.
              </span>
            </>
          )}
        </div>
      )}

      <div className="form-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={onCancel}
        >
          Cancel
        </button>

        <button
          type="submit"
          className="primary-button"
          disabled={
            saving ||
            duplicate ||
            !requiredReady
          }
        >
          {saving
            ? "Saving…"
            : document
              ? "Save changes"
              : "Save and record route"}
        </button>
      </div>
    </form>
  );
}