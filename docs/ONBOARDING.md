# MSE developer onboarding

> **New to Agorail?** Start with
> [Try Agorail in Five Minutes](https://github.com/agorail-labs/subscription-change-quote/blob/main/docs/TRY-AGORAIL-IN-FIVE-MINUTES.md)
> — the published MSE and SCQ packages composed in one clean consumer
> project. This guide is the MSE-only deep dive.

Mutation Safety Envelope (MSE) is a **domain-blind safety contract** for
changing existing commercial state — an order, an itinerary, a subscription,
a billing contract. Commerce systems increasingly let autonomous agents
modify such state, and a successful API call does not by itself tell the
agent what was predicted, what was guaranteed, whether the change was even
*admissible* as a set, or whether downstream effects are final.

The problem MSE solves first is the **pre-dispatch** one: a change is
usually a set of interdependent units (raise the seats *and* co-include the
add-on the new tier requires). Dispatching an incomplete set can succeed
unit-by-unit while violating the change's own declared dependencies. MSE
lets a caller declare those dependencies as admission relations, evaluate
the whole set against them **read-only**, and get one of two evidence-bearing
answers before anything is dispatched:

- **`ADMISSION_PASSED`** — an admission report with per-relation coverage
  and satisfaction evidence; or
- **`ADMISSION_REFUSED`** — an admission refusal whose failures carry
  **witnesses**: for a `COMPLETE` witness, the exact transitions an amended
  proposal must add to become admissible.

MSE's core is domain-blind: it contains no SKUs, fares, plans, billing
periods, or seat counts. Domains instantiate it through profiles/adapters;
the core owns only the safety semantics. The normative text is
[`spec/normative-spec.md`](../spec/normative-spec.md); the JSON Schema is
the machine-readable contract (see below). MSE is an independent research
proposal — see [`docs/DISCLAIMER.md`](DISCLAIMER.md) — and is not an
official specification of any vendor or standards body.

## Install

```bash
npm install @agorail-labs/mse-reference@experimental
# or pin the exact audited version:
npm install @agorail-labs/mse-reference@0.4.0-experimental.1
```

Node 20 or 22. The package is ESM; import from the package root (there is
no `./core` subpath export):

```js
import { evaluateAdmissionOnly } from "@agorail-labs/mse-reference";
```

The normative JSON Schema ships as the `./schema` subpath. It is a JSON
module, so import it with the `type: "json"` import attribute:

```js
import schema from "@agorail-labs/mse-reference/schema" with { type: "json" };
```

### A note on dist-tags (Phase 1 rationale)

npm requires every package to keep a `latest` dist-tag; removing it was
attempted on 2026-11-02 and rejected by the registry (400). `latest`
therefore points at the current experimental version; the `0.0.0-stage`
placeholder exists but is untagged and is never a resolution fallback.
Always install with `@experimental` or an exact version.

## Getting started

The repository ships a runnable consumer example under
[`examples/consumer/`](../examples/consumer/). It runs against the
**published** package — install it as above, then:

```bash
node examples/consumer/multi-unit-admission.mjs
```

The example models a seat expansion as two dependent units — the seat
quantity change, plus the analytics add-on it requires — declares a
`REQUIRES_COINCLUSION` relation between them, and evaluates admission
twice: once for the complete change, once with the add-on missing. The
`AdmissionEvaluator` is supplied by the caller: because MSE is
domain-blind, the evaluator is where the integrator's own state knowledge
enters. It reports per-relation failures (with witnesses) and coverage;
`evaluateAdmissionOnly` validates that evidence and renders the decision.
Admission itself performs no mutation.

Expected output:

```text
Complete change (seats + add-on): ADMISSION_PASSED
  coverage: rel-seats-require-addon:PASSED
  failures: 0
Incomplete change (seats only): ADMISSION_REFUSED
  failed relation: rel-seats-require-addon
  witness disposition: COMPLETE
  missing unit named by the witness: addon-analytics
Done: admission passed the complete change and refused the incomplete one before dispatch.
```

The refusal is the actionable part: instead of a bare "no", the integrator
gets the missing unit named by the witness, amends the proposal, and
re-quotes — admission is a gate with evidence, not a verdict without
recourse. The package also exports well-formedness assertions
(`assertAdmissionReportWellFormed`, `assertAdmissionRefusalWellFormed`,
`assertQuoteUnitsWellFormed`, `assertCommitResponseWellFormed`),
`deriveSatisfactionRealization`, a `ReferenceProvider`, and the
`MseViolation` error type. Note the boundary the specification draws: an
admitted pass is admission-time truth — it is never, by itself, proof that
a satisfaction took effect at execution time; realization is derived
separately at execution.

## MSE and SCQ: separate specifications that complement each other

[SCQ (Subscription Change Quote)](https://github.com/agorail-labs/subscription-change-quote)
is the companion project. They are separate specifications because they
answer different questions at different points in a change's life:

| | MSE | SCQ |
| --- | --- | --- |
| Question | Is this **set of changes admissible** — are all dependent units present and the declared relations satisfied? | What will this subscription change **cost and do**, was it committed, and did the outcome stay within what was quoted? |
| Scope | Domain-blind: any commercial state, via profiles | Subscription changes specifically (quantity, plan, cadence, cancellation) |
| Moment | **Before** dispatch — read-only | Quote → acceptance → commit → receipt → reconciliation |
| Output | Admission report or refusal with witnesses | Quote with determinacy and guarantee coverage; an immutable receipt with a verification verdict |
| Mutates? | Never (admission-only evaluation is side-effect-free) | Governs the commit lifecycle (in the reference package, against simulators only) |

Used together: MSE decides **admissibility** of a multi-unit change;
SCQ governs the **financial commitment** for the subscription change that
passes the gate. A worked pipeline — MSE gate first, then SCQ quote,
commit, and durable replay protection — lives in the SCQ repository as
`examples/consumer/mse-plus-scq.mjs`. That integration is experimental
example source code, not an API exported by either published package.

## Guarantees given — and not given

Given, within the experimental reference package:

- Admission decisions are evidence-bearing on both paths: passes expose
  per-relation coverage and satisfactions; refusals expose failures with
  witnesses that name what an amended proposal must change (when the
  witness disposition is `COMPLETE`).
- Admission evaluation is side-effect-free: it reads a proposal, a quote,
  and caller-supplied evaluator evidence, and mutates nothing.
- The shipped JSON Schema is the same contract the reference
  implementation validates against.

**Not** given — in the package's own terms, it does **not** provide
authorization, durable execution, billing provider integration, or
exactly-once semantics:

- **Admission is not authorization.** A passed admission says the change
  set is complete and consistent with its declared relations. Whether the
  change may happen at all — identity, approval, budget, entitlements —
  is a separate business decision MSE does not make.
- **Admission is not execution.** MSE does not dispatch, commit, or
  persist mutations, and provides no durable execution or exactly-once
  guarantee. A pass is not proof that any satisfaction took effect.
- **No billing integration.** The reference provider is an in-memory
  model for evaluation; nothing here connects to a production billing
  provider.
- MSE does not define identity, authentication, delegation, payment
  authorization, transport, resource schemas, refunds, fulfillment, or
  settlement — it composes with the protocols that do.

## Filing bugs and feedback

- **Bugs / specification inconsistencies / conformance gaps:**
  [GitHub Issues](https://github.com/agorail-labs/mutation-safety-envelope/issues).
  A reproducible report names the package version, the Node version, the
  proposal/quote/evaluator inputs involved, and the decision or error
  observed. Never post real customer data, billing account data, or
  secrets.
- **Adoption feedback:** open an issue labeled as feedback, or a
  discussion if enabled. Independent reproductions — install results,
  example runs, code-review findings — are recorded in the SCQ
  repository's adoption tracker
  ([`docs/ADOPTION-TRACKER.md`](https://github.com/agorail-labs/subscription-change-quote/blob/main/docs/ADOPTION-TRACKER.md))
  once verified. Being recorded there reflects the specific verified
  evidence only, not use or endorsement beyond it.
