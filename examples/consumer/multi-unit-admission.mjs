/**
 * MSE consumer example: admission of a multi-unit change.
 *
 * Runs against the published @agorail-labs/mse-reference package.
 *
 * A subscription seat expansion is modeled as two dependent units:
 * raising the seat quantity REQUIRES the analytics add-on to be
 * co-included in the same change. MSE admission is a read-only,
 * pre-dispatch gate: it never mutates anything. It either passes the
 * whole change with per-relation coverage evidence, or refuses it
 * before dispatch with a witness that names exactly what is missing.
 *
 * The AdmissionEvaluator below stands in for the integrator's own
 * state reader: MSE is domain-blind, so the evaluator (supplied by
 * the caller) reports whether each declared relation is satisfied.
 */
import { evaluateAdmissionOnly } from "@agorail-labs/mse-reference";

const seatTransition = { kind: "SET_ITEM_QUANTITY", itemId: "seats", quantity: 120 };
const addonTransition = { kind: "ADD_ITEM", itemId: "addon-analytics" };

const proposal = {
  proposalId: "prop-seat-expansion-1",
  target: { subscriptionId: "sub-1" },
  change: { description: "seats 100 -> 120, requires analytics add-on co-included" },
};

const seatUnit = {
  unitRef: "unit-seats",
  unitLocator: { scopeRef: "sub-1", unitKey: "seats" },
  transition: seatTransition,
  effects: [
    {
      effectId: "eff-seat-qty",
      type: "subscription:seat_quantity",
      value: { type: "number", value: 120 },
      guarantee: { mode: "EXACT" },
    },
  ],
};
const addonUnit = {
  unitRef: "unit-addon",
  unitLocator: { scopeRef: "sub-1", unitKey: "addon-analytics" },
  transition: addonTransition,
  effects: [],
};
const relations = [
  {
    relationId: "rel-seats-require-addon",
    type: "REQUIRES_COINCLUSION",
    triggerUnitRefs: ["unit-seats"],
    scopeRef: "sub-1",
  },
];
const at = new Date("2026-08-01T00:00:00.000Z");

// ------------------------------------------------------------------
// Case 1: the complete change — seats plus the dependent add-on.
// The evaluator reports the co-inclusion relation satisfied by the
// add-on unit present in the same request.
// ------------------------------------------------------------------
const completeQuote = {
  quoteId: "quote-complete",
  target: { subscriptionId: "sub-1" },
  units: [seatUnit, addonUnit],
  admissionRelations: relations,
};
const satisfiedEvaluator = () => ({
  failures: [],
  coverage: [
    {
      relationId: "rel-seats-require-addon",
      status: "PASSED",
      satisfactions: [
        { source: "CURRENT_REQUEST", unitRef: "unit-addon", transition: addonTransition },
      ],
    },
  ],
});

const passed = evaluateAdmissionOnly(proposal, completeQuote, satisfiedEvaluator, at);
console.log("Complete change (seats + add-on):", passed.kind);
if (passed.kind === "ADMISSION_PASSED") {
  console.log(
    "  coverage:",
    passed.admissionReport.coverage.map((c) => `${c.relationId}:${c.status}`).join(", "),
  );
  console.log("  failures:", passed.admissionReport.failures.length);
}

// ------------------------------------------------------------------
// Case 2: the incomplete change — the seat unit alone. The declared
// relation requires the add-on, and it is absent. Admission refuses
// BEFORE any dispatch, and the refusal carries a COMPLETE witness:
// the exact transition an amended proposal must add.
// ------------------------------------------------------------------
const incompleteQuote = {
  quoteId: "quote-incomplete",
  target: { subscriptionId: "sub-1" },
  units: [seatUnit],
  admissionRelations: relations,
};
const refusingEvaluator = () => ({
  failures: [
    {
      relationId: "rel-seats-require-addon",
      witness: {
        disposition: "COMPLETE",
        requiredTransitions: [
          { unitLocator: { scopeRef: "sub-1", unitKey: "addon-analytics" }, transition: addonTransition },
        ],
      },
    },
  ],
  coverage: [{ relationId: "rel-seats-require-addon", status: "FAILED" }],
});

const refused = evaluateAdmissionOnly(proposal, incompleteQuote, refusingEvaluator, at);
console.log("Incomplete change (seats only):", refused.kind);
if (refused.kind === "ADMISSION_REFUSED") {
  const failure = refused.admissionRefusal.failures[0];
  console.log("  failed relation:", failure.relationId);
  console.log("  witness disposition:", failure.witness.disposition);
  console.log(
    "  missing unit named by the witness:",
    failure.witness.requiredTransitions.map((r) => r.unitLocator.unitKey).join(", "),
  );
}

if (passed.kind !== "ADMISSION_PASSED" || refused.kind !== "ADMISSION_REFUSED") {
  console.error("Unexpected admission outcomes — see the MSE conformance docs.");
  process.exit(1);
}
console.log("Done: admission passed the complete change and refused the incomplete one before dispatch.");
