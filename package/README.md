<p align="center">
  <a href="https://github.com/agorail-labs"><img src="https://raw.githubusercontent.com/agorail-labs/.github/main/assets/agorail-mark.svg" width="76" alt="Agorail Labs logo"></a>
</p>

# Mutation Safety Envelope (MSE)

**Read-only admission checks for multi-unit changes initiated by AI agents.**

[![Release candidate](https://img.shields.io/badge/release-1.0.0--rc.2-orange)](https://www.npmjs.com/package/@agorail-labs/mse-reference) [![CI](https://github.com/agorail-labs/mutation-safety-envelope/actions/workflows/ci.yml/badge.svg)](https://github.com/agorail-labs/mutation-safety-envelope/actions/workflows/ci.yml) [![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-43853d)](https://github.com/agorail-labs/mutation-safety-envelope) [![Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue)](https://github.com/agorail-labs/mutation-safety-envelope/blob/main/LICENSE)

Part of **[Agorail Labs](https://github.com/agorail-labs)** · [SCQ companion package](https://www.npmjs.com/package/@agorail-labs/scq-reference) · [Five-minute combined walkthrough](https://github.com/agorail-labs/subscription-change-quote/blob/main/docs/TRY-AGORAIL-IN-FIVE-MINUTES.md)

> **Release candidate for independent technical evaluation; not production-certified.** MSE does not grant authorization, contact a billing provider, guarantee exactly-once effects, or provide durable business-intent execution. A passed admission check is *not* permission or proof of execution.

## Why MSE?

Suppose an agent proposes increasing a SaaS subscription from 100 to 120 seats, but that increase requires an analytics entitlement in the same change. Checking each individual operation independently can miss that dependency.

| Proposed change | MSE response | Why |
| :-- | :-- | :-- |
| Increase seats only | **ADMISSION_REFUSED** | Repair witness identifies the missing entitlement |
| Increase seats **and** include the entitlement | **ADMISSION_PASSED** | The required co-inclusion is satisfied at admission time |

MSE evaluates the proposed set against caller-supplied current-state evidence **before dispatch**. It can also validate structured quote, admission, refusal, and commit-outcome records. It does not execute a live commercial change.

```text
Proposal + quote + current-state evidence
             |
     MSE admission check
       /             \
    REFUSED          PASSED
  repair witness    evidence of admission
       |                |
  revise / re-quote   separate authorization + executor
                      (provided by the integrator)
```

## Install

**Node.js 22+, ESM.** Select the explicitly pre-release `next` channel:

```bash
npm install --save-exact @agorail-labs/mse-reference@next
```

Import the supported admission and validation APIs:

```js
import {
  evaluateAdmissionOnly,
  assertAdmissionReportWellFormed,
  assertAdmissionRefusalWellFormed,
  deriveSatisfactionRealization,
} from "@agorail-labs/mse-reference";
```

`evaluateAdmissionOnly(proposal, quote, evaluator, now)` returns a decision with either admission evidence or a named repair witness. The caller implements `evaluator` against trustworthy provider/current-state observations and decides separately whether a permitted action may be dispatched.

The JSON Schema is available from `@agorail-labs/mse-reference/schema`.

**Run it:** [Runnable MSE admission example](https://github.com/agorail-labs/mutation-safety-envelope/blob/main/examples/consumer/multi-unit-admission.mjs) · [MSE API reference](https://github.com/agorail-labs/mutation-safety-envelope/blob/main/docs/API-REFERENCE.md)

## See both Agorail packages working together

<a href="https://github.com/agorail-labs/.github/blob/main/assets/demo/agorail-demo-90s.mp4"><img src="https://raw.githubusercontent.com/agorail-labs/.github/main/assets/demo/poster.png" width="680" alt="Agorail demonstration: admission, quote, execution uncertainty and receipt replay"></a>

[Watch the 92-second narrated demo](https://github.com/agorail-labs/.github/blob/main/assets/demo/agorail-demo-90s.mp4) · [Run the five-minute demo](https://github.com/agorail-labs/subscription-change-quote/blob/main/docs/TRY-AGORAIL-IN-FIVE-MINUTES.md)

MSE answers **"Is this whole proposed set admissible?"** SCQ answers **"What will this subscription change cost, and what can we establish after an authorized commit?"** They compose in consumer code; neither published package depends on the other.

## Guarantees and boundaries

| In scope for this candidate | Outside this package |
| :-- | :-- |
| Pre-dispatch admission with dependency witnesses | Authentication, consent, delegation or payment authorization |
| Well-formedness checks on admission and outcome records | Live provider writes, durable attempt storage or duplicate-intent fencing |
| Per-unit outcome/finality representations, including unknown | Atomic multi-provider changes or provider-side exactly-once guarantees |
| Versioned exported JSON Schema | Certification, vendor endorsement or proof of downstream finality |

**`ReferenceProvider.commit()` is an in-memory simulator** and must never be treated as a read-only check before a real commercial mutation. Use `evaluateAdmissionOnly` for admission; apply a separate authorization policy and durable executor where needed.

## Documentation and evaluation

- [Specification and contract](https://github.com/agorail-labs/mutation-safety-envelope/tree/main/spec)
- [Public API and migration notes](https://github.com/agorail-labs/mutation-safety-envelope/blob/main/docs/API-REFERENCE.md)
- [Security policy](https://github.com/agorail-labs/mutation-safety-envelope/blob/main/SECURITY.md)
- [Independent evaluation instructions](https://github.com/agorail-labs/mutation-safety-envelope/blob/main/docs/STABLE-CANDIDATE-REVIEW.md)
- [File an issue or counterexample](https://github.com/agorail-labs/mutation-safety-envelope/issues)

**Package vs. specification:** `1.0.0-rc.2` is an npm release-candidate version, not a stable production guarantee or a declaration that an external standard adopted MSE. This README describes the packaged candidate, not any unshipped bridge or provider integration.
