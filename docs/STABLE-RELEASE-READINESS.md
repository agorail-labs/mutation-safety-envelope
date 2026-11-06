# Stable Release Readiness — Mutation Safety Envelope (MSE)

**Status: QUALIFICATION IN PROGRESS — nothing in this document is a
stability claim.** The only published artifact is
`@agorail-labs/mse-reference@0.4.0-experimental.1`. This document
defines the proposed stable core, the contract it would carry, and
every known blocker with an owner and a completion criterion. It is
part of the Agorail Stable Release Engineering Program (November
2026).

## 1. The version distinction (read first)

Three different artifacts share the MSE name. A stable release must
never blur them:

| Artifact | Identifier | Status |
|---|---|---|
| Published npm package | `@agorail-labs/mse-reference@0.4.0-experimental.1` | Experimental snapshot; the only artifact external consumers can install |
| Repository source | `0.4.0-dev.0` (root `package.json`, private) | Unreleased development line; contains changes the published snapshot does not |
| Normative specification | in-repo spec documents | Versioned separately from both packages |

**Resolution rule for 1.0:** the stable scope below is defined
against the *published* package's behavior, because that is the only
behavior with external consumers. Any `0.4.0-dev.0` source change
enters the stable scope only by being (a) enumerated in the API
compatibility report, (b) covered by the snapshot/compatibility
tests, and (c) called out in the migration guide. Unenumerated dev
changes are excluded by default, not silently broadened in.

## 2. Proposed stable core

### 2.1 In scope — supported public contracts

| Surface | Exports | Contract summary |
|---|---|---|
| Admission evaluation | `evaluateAdmissionOnly` → `AdmissionOnlyDecision` | Given a proposed multi-unit change and its evidence, decides admission only. A pass is **not** authorization and **not** execution; the function performs no dispatch and holds no provider credentials. |
| Admission evidence validation | `assertAdmissionReportWellFormed`, `assertAdmissionRefusalWellFormed` | Structural validation of admission reports and refusals; throws `MseViolation` on malformed evidence. Untrusted evidence is rejected, never repaired. |
| Quote/commit response validation | `assertQuoteUnitsWellFormed`, `assertCommitResponseWellFormed` | Structural validation of provider-shaped quote units and commit responses at the boundary. |
| Satisfaction realization | `deriveSatisfactionRealization` | Derives per-unit realization from outcomes; partial execution can never aggregate into a globally successful result. |
| Core types | `export type *` from `core/types` (admission request/report/refusal, unit specs, guarantee and finality representations) | Type-level contract; finality representations distinguish *final* from *unknown* — unknown finality is a value, never silently promoted. |
| JSON Schema | `@agorail-labs/mse-reference/schema` (`mse-core.schema.json`) | Machine-checkable form of the core structures; versioned with the package. |

### 2.2 In scope with a narrower promise

| Surface | Promise |
|---|---|
| `ReferenceProvider`, `AdmissionEvaluator`, `AdmissionEvaluation`, `Quoter` | Reference/test scaffolding. Supported as *examples of the evaluator shape*, not as production provider integrations. No real provider behavior is implied. |

### 2.3 Explicitly excluded from the stable core

- Authorization decisions of any kind (admission ≠ authorization,
  permanently).
- Execution or dispatch of changes to any real system.
- Exactly-once, atomicity, or cross-system guarantees.
- Any claim about a real provider's behavior.
- The source-only MSE–SCQ business-intent bridge (it lives in the
  SCQ repository's v0.7 source line, is in neither published package,
  and remains experimental — see the SCQ readiness document).

## 3. Behavioral guarantees the stable core must evidence

Each guarantee names the test evidence that must exist at the
candidate commit before it can be claimed:

1. Missing required co-inclusion ⇒ refusal (never partial admit).
2. Malformed or untrusted admission evidence ⇒ `MseViolation`,
   never coerced acceptance.
3. An admission pass carries no execution or authorization
   semantics — enforced structurally: `evaluateAdmissionOnly`
   accepts no dispatch callback and returns a decision type with no
   execution fields.
4. Stale evidence does not satisfy a current requirement
   (evidence-time checks are part of well-formedness).
5. Partial execution outcomes never aggregate to global success
   (`deriveSatisfactionRealization`).
6. Unknown effect finality is represented explicitly and never
   promoted to final by any aggregation.

## 4. Blockers

| ID | Blocker | Owner | Completion criterion |
|---|---|---|---|
| B-MSE-1 | Source (`0.4.0-dev.0`) vs published (`0.4.0-experimental.1`) divergence | This program (Phase 2) | **ENUMERATED 2026-11-05:** the newest `src/` commit is `7703f27` (2026-11-01, the release-prep commit for the published artifact itself); the only later commit is documentation. Export-surface extraction is identical (8 values, 42 types, both sides). **There is no code divergence** — the distinction is a version-label artifact only. Closed for scope purposes; the 1.0 versioning decision (B-MSE-6) absorbs it. |
| B-MSE-2 | No `SECURITY.md`; no private vulnerability reporting route | This program (Phase 4) | `SECURITY.md` merged; private reporting enabled on the repository (admin action) |
| B-MSE-3 | Supported Node matrix (22/24/26 LTS) not yet validated at a candidate commit | This program (Phase 5) | Full suite + build + schema validation + consumer smoke green on all three, transcripts recorded |
| B-MSE-4 | No public API snapshot / compatibility tests | This program (Phase 2) | Snapshot tests in CI fail on any unreviewed export-surface change |
| B-MSE-5 | No independent evaluation of the stable candidate | External reviewers; maintainer to invite | ≥2 substantive evaluations with reproducible evidence, at least one adversarial (per program Phase 7) |
| B-MSE-6 | Maintainer approval of the stable scope itself | Maintainer (Arjun) | Explicit approval of §2 as the 1.0 contract |

## 5. What "stable" would and would not mean

If the gates pass, `1.0.0` would mean: the §2 API keeps semantic-
versioning compatibility, the §3 behaviors are regression-tested,
and security fixes land per the maintenance policy. It would never
mean production certification, provider endorsement, or that
admission confers authority to execute anything.
