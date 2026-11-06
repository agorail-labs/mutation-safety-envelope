# Mutation Safety Envelope (MSE)

**Status:** Experimental / External Review Candidate
**License:** Apache-2.0

**Part of [Agorail](https://github.com/agorail-labs) — safety contracts for AI-driven commerce changes.**

An AI agent is asked to increase a SaaS subscription from 100 to 120 seats. The change is
only safe as a *set*: the seat increase requires a dependent entitlement to be added in the
same change, and across a multi-unit change one unit may apply, another refuse, and a third
end in an unknown state. A single `SUCCESS` flag cannot express any of that — and dispatching
an incomplete set can succeed unit-by-unit while violating the change's own dependencies.

Mutation Safety Envelope (MSE) is a domain-blind safety contract that evaluates whether a
proposed collection of changes is **admissible — including its required dependencies —
before dispatch**, and gives the caller evidence-bearing answers instead of a flag:
`ADMISSION_PASSED` with per-relation coverage and satisfaction evidence, or
`ADMISSION_REFUSED` with witnesses that name exactly what is missing.

Commerce systems increasingly let agents modify existing commercial state —
edit an order, change an itinerary, modify a subscription, amend a billing
contract, cancel or partially change an existing commitment. A successful
API call does not, by itself, tell an autonomous agent what was predicted,
what was guaranteed, whether the mutation definitely happened, or whether
downstream effects like refunds are final. MSE standardizes that safety
boundary without standardizing the underlying commerce domain.

## What MSE does and does not do

**Does**

- Evaluates a proposed multi-unit change **read-only, before dispatch**: admission relations
  (for example, required co-inclusion of a dependent unit) are checked as a set, and a refusal
  carries a repair witness naming the missing transitions.
- Previews consequences per unit — scoped identity, opaque transition, predicted effects with
  per-effect guarantees (`EXACT | REVALIDATE | UNKNOWN`) — and, at commit, reports one result
  **per unit** (`APPLIED | REFUSED | INDETERMINATE`) with per-effect finality, instead of one
  success flag for the whole mutation.

**Does not**

- **Grant authorization.** Admission is not permission: whether a change may happen at all
  remains the caller's decision, outside MSE.
- Define identity, authentication, delegation, payment authorization, transport, generic
  idempotency, resource schemas, inventory reservation, refunds, fulfillment, payment
  settlement, or procurement — see [What MSE does not define](#what-mse-does-not-define).
- Provide exactly-once provider execution, atomic cross-unit or cross-provider updates, or
  production-certified safety. An admitted pass is admission-time evidence, never proof that
  a satisfaction took effect.

> MSE is **not** an official specification of UCP, ACP, Shopify, Salesforce,
> IATA, Paid, Stripe, Paddle, Zuora, Chargebee, or any other vendor or
> standards body. It is an independent research proposal. See
> [`/docs/DISCLAIMER.md`](docs/DISCLAIMER.md).

## Source tree and published npm artifacts

The root development package and the installable npm reference package have **different version identifiers**. The authoritative installed behavior is always the exact npm artifact you select.

- **Release-candidate channel:** [`@agorail-labs/mse-reference@next`](https://www.npmjs.com/package/@agorail-labs/mse-reference) tracks the most recently published RC. The package subdirectory prepares `1.0.0-rc.2` with clearer developer documentation; publication requires a separate protected workflow run.
- **Experimental snapshot:** `@agorail-labs/mse-reference@0.4.0-experimental.1` is still available under `@experimental`, including for historical comparisons.
- **Root development package:** its internal `0.4.0-dev.0` version is not the npm release version. Code in `src/` is packaged through the curated `package/` export surface; consult the [API reference](docs/API-REFERENCE.md) and [release qualification](docs/STABLE-RELEASE-READINESS.md) for the contract and limitations.

Admission is not authorization; neither version provides live provider execution or exactly-once guarantees.

## Get the package

Release candidates and experimental snapshots on npm:
[**`@agorail-labs/mse-reference`**](https://www.npmjs.com/package/@agorail-labs/mse-reference)

```bash
npm install @agorail-labs/mse-reference@next
```

Node.js 22+, ESM. The package remains a reference implementation, not a production-certified system.

## Minimal runnable example

The published package refusing an incomplete change and admitting the complete one
([`examples/consumer/multi-unit-admission.mjs`](examples/consumer/multi-unit-admission.mjs)):

```bash
git clone https://github.com/agorail-labs/mutation-safety-envelope.git
mkdir mse-quickstart && cd mse-quickstart
npm init -y
npm install --save-exact @agorail-labs/mse-reference@next
cp ../mutation-safety-envelope/examples/consumer/multi-unit-admission.mjs .
node multi-unit-admission.mjs
```

Expected simulator output (validate against the exact RC installed in your project):

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

To see MSE composed with SCQ's financial lifecycle — quote, separate approval policy,
commit, durable replay — run
[**Try Agorail in Five Minutes**](https://github.com/agorail-labs/subscription-change-quote/blob/main/docs/TRY-AGORAIL-IN-FIVE-MINUTES.md)
in the SCQ repository.

## How MSE and SCQ complement each other

MSE answers the pre-dispatch question: *is this set of changes admissible as a whole?*
[**SCQ (Subscription Change Quote)**](https://github.com/agorail-labs/subscription-change-quote)
answers the financial question for subscriptions: *what will this change cost, how strongly
is that guaranteed, and did the committed outcome stay within what was approved?* The two
published packages compose in user code; neither package's API depends on the other, and
each can be adopted independently. SCQ on npm:
[`@agorail-labs/scq-reference`](https://www.npmjs.com/package/@agorail-labs/scq-reference).

## Documentation

- [Developer onboarding](docs/ONBOARDING.md) — package install, the runnable admission
  example, and how MSE composes with SCQ.
- [Normative specification](spec/normative-spec.md) — the contract itself.
- [Before you rely on this](#before-you-rely-on-this) — disclaimer, audits, ambiguities, and
  falsification notes.
- [Independent review package](https://github.com/agorail-labs/subscription-change-quote/blob/main/docs/INDEPENDENT-MSE-SCQ-REVIEW.md)
  — reproduce, falsify, and report findings across both projects.
- [Contributing](CONTRIBUTING.md)

## The core claim, in one diagram

```text
Proposal
   ↓
Quote (one or more independently committing units)
   ├── per unit: scoped identity + opaque transition + predicted effects
         ├── guarantee per effect   (EXACT | REVALIDATE | UNKNOWN)
         ├── guarantee horizon
         └── acceptance constraints
   └── stable directional admission relations (no frozen witness)
   ↓
Admission against live state
   ├── refused before dispatch → admission report + failure witnesses
   │                              → amended proposal → new quote
   └── passed → wire-visible admission report + satisfaction evidence
         │            (admission-time truth; realization derived at execution)
         ↓
Commit  →  one result PER UNIT, not one for the whole mutation:
   ├── unit A: APPLIED
   ├── unit B: REFUSED
   └── unit C: INDETERMINATE        (reconciliation contract — never blind retry)
   ↓
Receipt
   └── per committed effect, effect finality: FINAL | PENDING | FAILED | UNKNOWN
```

MSE distinguishes a pre-dispatch admission gate plus three separate safety
questions that a single `SUCCESS` flag collapses: **quote stability**,
**admission validity**, **commit determinacy** (per independently
committing unit), and **effect finality**. Admission is not a fourth commit
outcome; it is the known no-dispatch branch. See
[`/spec/normative-spec.md`](spec/normative-spec.md) §1d, §2, §3.2.

## Repository layout

```text
/schema             Normative JSON Schema (draft 2020-12) — the actual contract
/spec               Normative spec prose: lifecycle rules, guarantee semantics (incl. money), open issues
/src/core           TypeScript reference types + validation helpers + a minimal in-memory provider
/scripts            Standalone tooling, e.g. strict-mode schema compile check
/test               Behavioral tests (vitest) + schema-conformance tests (ajv) over /examples
/examples           Four modeled/tested example domains: retail, travel, subscription, contract-billing
                    — each with a quote fixture and an enforceable monetary AcceptanceConstraint fixture.
                    These are illustrative examples only, not evidence of external validation or adoption.
/ucp-binding        Non-normative sketch of MSE as a UCP capability
/docs
  DISCLAIMER.md            Independent-research disclaimer (read this first)
  ambiguities.md           Open ambiguities in the source design, surfaced deliberately
  security-considerations.md
  conformance.md
  falsification-notes.md   What's been tested, what hasn't, what would falsify the hypothesis
  readiness-report.md      Publication readiness report and revision history
  v0.2-review-response.md  Historical per-unit outcomes + reconciliation response
  v0.3-design-decision.md  Admission response and repair-by-requote decision
  v0.3-review-response.md  Traceability for the live-witness iteration
  v0.3-audit-report.md     Semantic and consistency self-review findings
  request-reporting-design.md  v0.4.0-dev.0 coverage decision
  request-reporting-audit.md   Request-level semantic/consistency audits
```

## What MSE does not define

Identity, authentication, delegation, payment authorization, transport,
HTTP conditional requests, generic idempotency systems, order/subscription/
travel resource schemas, inventory reservation, refunds, fulfillment,
payment settlement, or procurement. MSE composes with existing protocols
and provider APIs; it does not replace them. See
[`/spec/normative-spec.md`](spec/normative-spec.md) §1.

## Architecture: core vs. profiles

```text
             Mutation Safety Envelope
                      │
        ┌─────────────┼─────────────┐
        ↓             ↓             ↓
      Retail        Travel      Subscription
      profile       profile       profile
```

The core owns safety semantics. Profiles/adapters own commercial
vocabulary. The core schema contains no SKUs, fares, plans, billing
periods, seat counts, or refund rules — see `/examples` for how four
different domains instantiate the same core without adding to it.

## Working from this source tree

The commands below build and test the repository's internal development source,
not the installed npm release-candidate artifact. For the published package, see
[Get the package](#get-the-package) and the
[developer onboarding guide](docs/ONBOARDING.md).

```bash
npm install
npm test                # current-contract tests
npm run test:baseline   # 2 separate cases against recorded v0.3.0 core
npm run build            # tsc typecheck/build
npm run validate-schema  # compiles the JSON Schema standalone under ajv strict mode
```

## Before you rely on this

This is an experimental research implementation, not a production-certified
provider integration or independently adopted standard. Start with:

1. [`/docs/DISCLAIMER.md`](docs/DISCLAIMER.md) — what MSE is not.
2. [`/docs/v0.3-review-response.md`](docs/v0.3-review-response.md) — what
   the later stable-relation/live-witness feedback changed, and what it did
   not establish.
3. [`/docs/v0.2-review-response.md`](docs/v0.2-review-response.md) — the
   preserved historical response on per-unit outcomes and reconciliation.
4. [`/docs/v0.3-audit-report.md`](docs/v0.3-audit-report.md) — adversarial
   semantic and cross-artifact consistency findings.
5. [`/docs/ambiguities.md`](docs/ambiguities.md) — resolved and open design
   questions, including remaining concurrency and shared-effect limits.
6. [`/docs/falsification-notes.md`](docs/falsification-notes.md) — what has
   and has not actually been tested.
7. [`/docs/readiness-report.md`](docs/readiness-report.md) — the
   publication readiness report, covering both the v0.1.0 publication and
   the historical v0.3.0 revision's status; current findings are in the request-reporting audit.

## Review question

> Can a domain-blind safety layer represent real commercial mutations
> across multiple industries without absorbing domain-specific workflow
> semantics?

The goal of external review is falsification, not promotion.

## License

Apache-2.0. See [`LICENSE`](LICENSE).
