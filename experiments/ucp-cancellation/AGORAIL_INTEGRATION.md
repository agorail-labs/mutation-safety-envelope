# Agorail integration and limits

Both **published 1.0.0-rc.2 registry tarballs** were downloaded without lifecycle
scripts and their SHA-512 bytes compared to registry metadata. Pins and SHA-256
digests are in [evidence/registry-integrity.json](evidence/registry-integrity.json).
This does not claim a separate signature or provenance-attestation verification.

## MSE: a real, bounded use

The private experiment pins `@agorail-labs/mse-reference` exactly to `1.0.0-rc.2`.
`src/admission.mjs` imports its **published** `evaluateAdmissionOnly` export. No
local repository source, rebuilt distribution, or unpublished MSE code is used.

| MSE concept | Cancellation binding | Limit |
| --- | --- | --- |
| `MutationProposal` / `MutationQuote` identities | Internal, attempt-correlated admission check | Not UCP wire resources and not a Business price quote |
| Stable unit locator | Order ID plus Business-declared unit ID | Mapping is supplied by the binding; MSE cannot infer reversible units |
| `REQUIRES_COINCLUSION` | Fixture rule: cancelling goods-a requires goods-b in the same requested change | Not a universal merchant rule or a statement that both changes will commit |
| `ADMISSION_REFUSED` with complete witness | Missing required unit identified; no mutation dispatched | Witness cannot authorize or silently enlarge the request |
| `ADMISSION_PASSED` with coverage | Declared request dependency is satisfied at evaluation time | No authority, lock, policy approval, finality, atomic write or receipt |
| MSE commit/result simulator | Not called | Its three-outcome vocabulary is not substituted for #945's business-review lifecycle |

N23 executes a published-package refusal and inspects the named repair witness.
N24 executes a pass while one requested unit still awaits merchant approval.
An independent policy/eligibility decision can still refuse execution. A passed
co-inclusion check does not guarantee eventual co-realization of dependent
effects; if a real Business requires that stronger invariant it must commit
atomically or enforce its own execution dependency policy. This prototype does
not claim an execution dependency engine.

MSE itself is read-only in this path. The Business simulator owns authorization,
version validation, serialization, durable claims, idempotency, approval, effects,
and recovery. Keeping MSE optional at this implementation seam allows another
Business to implement the same UCP semantics with its own rule engine.

## SCQ: retain the financial discipline, keep the runtime separate

The published SCQ declarations and runtime exports were inspected directly in
the unpacked registry tarball, alongside the repository. SCQ is **not installed
as a runtime dependency**, and no SCQ billing adapter is called by cancellation.

The decisive mismatch is SCQ `CommercialEffect.immediate`: the net incurred
financial obligation at effective time. It is not cash collected, a refund's
settlement status, or a next-invoice amount. Its `recurring` dimension also has
no general meaning for a one-time Order cancellation. Mapping a $26.50 settled
refund to an SCQ immediate credit would silently change the semantic subject.

| Published SCQ functionality | Cancellation decision |
| --- | --- |
| `DETERMINED` / `UNKNOWN` / `NOT_APPLICABLE` dimension discipline | Reuse the principle locally: unknown refund has no amount; zero needs evidence. Do not claim SCQ types or receipt compatibility |
| Attributable post-commit evidence; `UNVERIFIED` distinct from violated | Reuse the distinction in analysis. All current refund observations remain simulated |
| Stable attempts, durable replay, provider-record reconciliation | Useful design precedent; this executor uses its own cancellation journal, not a fake `SubscriptionProvider` wrapper |
| Quote-relative financial bounds and subscription mutation adapters | Leave separate until a genuine subscription change with incurred-obligation semantics is modeled |
| Provider-shaped simulators | Not evidence of live provider behavior or independent interoperability |

An eventual general-purpose financial-observation module would be a separate
design and release task. This work makes no changes to published packages and
does not widen their semantics to accommodate UCP.

## Subsequent subscription-management extension aligned with #890

Recommend a **separate optional subscription-management capability**, with the
cancellation attempt/reconciliation discipline reused conceptually. A recurring
agreement outlives and generates multiple Orders; cancelling a particular Order
does not necessarily cancel that agreement, and stopping recurrence does not
necessarily refund or cancel an already created Order.

[#890 at its audited head](https://github.com/Universal-Commerce-Protocol/ucp/blob/e6ecae9a75f209b5446bc698d1b566b15dc04560/docs/specification/shopping/extensions/purchase-options.md)
enumerates purchase options, selects by opaque ID, freezes the selected option
and agreed schedules on the Order, and carries subscription policy/disclosure.
Its Order example points to `permalink_url` for management. It is not an API for
reading or mutating a subscription; no new subscription operation is attributed
to it here. Future recurring-order schedules are also distinct from payment
schedules for an existing checkout debt.

The smallest follow-on slice is **stop future recurring-order generation at the
next permitted boundary**, without changing historical Order snapshots:

1. Business exposes an opaque agreement reference related to originating Order
   line, frozen `purchase_option`, schedules, and subscription policy. Do not
   derive agreement identity from a line ID or invent a subscription ID in #890.
2. Read current agreement version, eligible actions, notice/cutoff constraints,
   effective cancellation time, and any required review.
3. Submit a version-bound, independently authorized request with a stable attempt
   key; reconcile lost responses without recreating a second attempt.
4. Distinguish request recorded, cancellation scheduled, agreement ended, final
   generated Order, and financial adjustments. Handle a renewal crossing the
   cancellation cutoff explicitly.
5. Keep existing generated Orders under the Orders cancellation contract. Never
   rewrite the original purchased terms as if they had always been different.

Only after identity and lifecycle review should SCQ quote and bound an actual
change in incurred obligations, cadence, commitment, and effective time. It can
then help with plan/quantity changes and financially material cancellation;
refund settlement remains separate. Subscription authority/scope, relation to
#890's policy, and the representation of a scheduled stop require maintainer
decisions. Do not assume `order:manage` grants authority over every future Order
or over a long-lived subscription.

Suggested next implementation: simulator-backed scheduled stop with a renewal
race and uncertain incurred-obligation quote. Pause, seat changes, swaps and
payment-method changes follow after that lifecycle is established.
