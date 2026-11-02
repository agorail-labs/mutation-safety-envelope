# @agorail-labs/mse-reference

Experimental MSE v0.4.0 admission and cross-unit dependency **reference implementation**.

**Not production-ready.** This package is not a billing API client or an official standard, and it does not implement authorization, durable attempt storage, duplicate business-intent detection, provider writes, atomic multi-unit changes, exactly-once execution or independently verified downstream effect finality. Real provider adapters, consistent state reads, authorization and finality evidence are deployment responsibilities.

## Installation

After the experimental version appears on npm:

```bash
npm install @agorail-labs/mse-reference@0.4.0-experimental.1
```

For this package, use the direct ESM entrypoint:

```js
import {
  evaluateAdmissionOnly,
  assertAdmissionReportWellFormed,
  deriveSatisfactionRealization,
} from "@agorail-labs/mse-reference";
```

`evaluateAdmissionOnly(proposal, quote, evaluator, now)` reads the external binding's live admission state and validates quote-correlated coverage. It returns either `ADMISSION_PASSED` with satisfaction evidence or `ADMISSION_REFUSED` with a repair witness. It performs **no provider dispatch**. A PASSED result is only admission-time evidence, not authority, a lock, a commitment or downstream finality. The supplied evaluator owns opaque history truth and real provider state consistency.

The MSE schema is exported as `@agorail-labs/mse-reference/schema`.

## Composing with SCQ

SCQ validates subscription financial commitments and uses its durable coordinator for at-most-once **dispatch authorization**; MSE supplies admission and dependency reports. The experimental composition lives in the SCQ repository [PR #57](https://github.com/agorail-labs/subscription-change-quote/pull/57) and its pinned cross-repository Node 20/22 CI. The demonstrated provider is simulated, not a certified live Chargebee integration.

`ReferenceProvider.commit()` is an in-memory **commit simulator**; never call it as a read-only preflight for a real commercial mutation. Call `evaluateAdmissionOnly` and a separately authorized, provider-safe durable executor instead.

## Release and trust

- Release track: `0.4.0-experimental.1`, prerelease `experimental` tag only.
- Source: `agorail-labs/mutation-safety-envelope`.
- Package includes compiled ESM, TypeScript declarations, normative JSON schema, license and this document.
- Clean-room install and artifact content checks run in CI on Node 20 and Node 22.
- Neither MSE nor SCQ guarantees provider-side exactly-once execution or full-list-update safety.
