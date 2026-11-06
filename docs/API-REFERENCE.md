# API Reference — @agorail-labs/mse-reference (stable-core candidate)

This reference covers the **proposed stable core** defined in
`docs/STABLE-RELEASE-READINESS.md` §2. Until a 1.0 release is
approved, the published artifact remains
`0.4.0-experimental.1`. Full export list and classifications:
`docs/API-INVENTORY.md`. The machine-checked surface is
`docs/api/public-api.snapshot.json` (8 values, 42 types).

## Admission evaluation

### `evaluateAdmissionOnly(proposal, quote, evaluator?, now?) → AdmissionOnlyDecision`

Decides whether a proposed multi-unit change is **admissible** —
nothing more. It performs no dispatch, holds no credentials, and
its result confers no authorization.

- If the quote declares admission relations, a live `evaluator`
  is required; without one the call throws `MseViolation`
  (fail-closed, never "no relations checked, assume pass").
- Evaluator evidence is validated: fabricated coverage, omitted
  relations, and PASSED claims missing mandatory satisfaction
  evidence are refused or thrown, never repaired.
- Returns `{ kind: "ADMISSION_PASSED", admissionReport }` or
  `{ kind: "ADMISSION_REFUSED", admissionRefusal }`. The decision
  object contains no execution-shaped fields (no commit result, no
  receipts, no finality) — pinned by test.
- A quote past its `expiresAt` is stale evidence; `isQuoteExpired`
  (internal, used by the reference provider) defines the check,
  and expired quotes are refused on the commit path.

## Validation (the trust boundary)

All validators throw **`MseViolation`** on malformed input —
including null/non-object input — and return void on success.

| Function | Validates |
|---|---|
| `assertQuoteUnitsWellFormed(quote)` | Unit/effect identity uniqueness within a quote |
| `assertAdmissionReportWellFormed(quote, proposal, report)` | Report↔quote↔proposal correlation, timestamps, coverage shape and correlation |
| `assertAdmissionRefusalWellFormed(quote, proposal, refusal)` | The above plus refusal witnesses: at least one failed relation, in-scope repair references, no contradictory requirements |
| `assertCommitResponseWellFormed(quote, proposal, response)` | Commit-response shape; returns the derived satisfaction-realization report for `COMMIT_RESULT` |

## Realization

### `deriveSatisfactionRealization(report, result) → SatisfactionRealizationReport`

Derives, per admission satisfaction, whether it was `REALIZED`,
`NOT_REALIZED`, or `INDETERMINATE` from the correlated execution
outcomes. Rules that are contract:

- A satisfaction citing a unit with no execution outcome **throws**
  — realization is never assumed.
- `allRealized` is deliberately non-vacuous: an evidence-free
  report yields `entries: []` and `allRealized: false`.
- A realization verdict is not an admission result and not a
  commit-success claim; read `unitResults` for execution truth.

## Schema export

`@agorail-labs/mse-reference/schema` → `mse-core.schema.json`
(draft 2020-12), the machine-checkable form of the core
structures, validated in CI under ajv strict mode.

## Reference scaffolding

`ReferenceProvider` and the `Quoter`/`AdmissionEvaluator` types are
supported as *examples of the evaluator/provider shape* for tests
and integrations. They are not production provider integrations,
and no real provider's behavior is implied by them.

## What this API never does

Authorize anything; execute or dispatch anything; hold credentials
or perform I/O; aggregate partial execution into global success;
promote unknown finality to final.
