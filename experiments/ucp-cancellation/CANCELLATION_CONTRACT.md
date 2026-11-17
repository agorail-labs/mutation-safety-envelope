# Minimal cancellation contract — experimental

This is an executable interpretation of the unapproved #943/#945 design, not a
new production UCP operation. `src/simulator.mjs` exposes local methods; there is
no REST server, MCP server, real OAuth verifier, or hosted extension schema here.
Example names are provisional and every proposed wire shape is experimental.

## Existing protocol versus proposed additions

| Existing UCP on audited main | Proposed #943/#945 semantics | Local adapter |
| --- | --- | --- |
| Profile/capability negotiation | Optional cancellation extension of Orders, parent required | Intersection of versioned local profile arrays; reserved `com.example.order_modification` |
| Order read, quantities, fulfillment | `order_version`, `modification` declaration | `order(ctx, negotiated)`; absent version/declaration when unnegotiated |
| Identity Linking and Order scopes | Appropriately authorized cancellation and attempt access | Simulated platform/buyer context; separate Business context for internal worker |
| `Idempotency-Key` raw-body matching | Durable modification ID and scoped-key association | `submit(ctx, caps, key, rawBody)` |
| No cancellation status operation | Current exact-attempt read and read-only lookup | `get(...)`, `lookup(...)` |
| No standardized cancellation fence | Explicit write to fence an unclaimed original key | `fence(..., freshFenceKey, originalKey)` |
| Order adjustments | Separate cancellation commitment and downstream finality | Current-schema adjustment objects plus local observation evidence |

No Agorail field or library is required at the protocol boundary. A UCP
implementation can satisfy every proposed invariant without MSE or SCQ.

## Read before write

The declaration exposes `granularity`, `atomicity`, whole-order availability and
processing mode, and stable unit IDs with Order-component targets and supported
operations. Amounts are integer minor units in `order.currency`. A unit's
`reversible_amount`/result `affected_amount` is attributed value;
`estimated_refund_amount` is a non-binding estimate. Omission is unknown, not 0.

Order-only is explicit. Capability absence is not Order-only. Pooled payment does
not imply structural impossibility; the Business declares what can be modified.
The fixture has two goods units and retained delivery. Its delivery target uses
`fulfillment_expectation` as an **experimental open-vocabulary value**, linking an
actual expectation, not a fictional line item or a standardized UCP target type.

Experimental request fragment, matching the shape in #945:

```json
{
  "base_order_version": "opaque-order-version-read-earlier",
  "operations": [
    { "op": "cancel", "target": { "type": "unit", "id": "goods-a" } }
  ]
}
```

Whole-order cancellation uses one `{ "type": "order" }` target. It cannot be
mixed with unit targets. Unknown addressing/support, duplicate targets, and stale
versions are distinct from an admitted request refused by policy. New-request
order: authorization, raw-byte idempotency lookup, version, shape, addressing,
support, durable claim, then Business processing. A stale version changes nothing
and creates no attempt. An exact replay returns the original cached response
before comparing the current version.

## Outcomes and commitment

| Outcome | Evidence and next action |
| --- | --- |
| `awaiting_business_decision` | Known request, no decision or dispatch yet; await Business worker |
| `committed` | Authoritative simulated Order mutation recorded; read adjustments for money |
| `refused` | Known decision before execution; reason required |
| `failed` | Execution conclusively did not commit; reason required |
| `indeterminate` | Execution commitment not established; reconcile exact attempt, never redispatch it |
| `not_attempted` | Named blocking condition prevented execution |

Request `status` is `open` while any result is pending, indeterminate, or unknown;
otherwise `closed`. Unknown outcome vocabularies must remain unresolved.

`per_unit` evaluates independent operations separately. `atomic` waits for every
required Business decision, then commits all requested operations in one simulated
state transaction, or commits none. Whole-order cancellation is one target and is
always indivisible in this simulator, even on a by-unit Order. Atomicity excludes
refund settlement. Terminal results do not change into success later.

Business decisions are internal simulator work, not a public `approve` UCP
operation. Approval expires after a fixture-defined hour. Expired/declined review
cannot dispatch. Before commitment, each affected target is checked against
current fulfillment, policy, prior cancellation and conflicting uncertain
execution. Two known pending reviews may coexist; commit-time serialization lets
at most one cancel the same unit. Unrelated Order-version changes alone do not
invalidate an already admitted review if affected eligibility still holds.

## Attempt identity and reconciliation

Use the existing raw-body SHA-256 identity rule from UCP signatures: parsed JSON
equality is insufficient. Matching key and raw bytes replay the original response;
changed bytes conflict. Key scope is authenticated Platform, Order, operation,
original key. Ownership checks also apply to status reads and replay. The client
generates UUIDv4 keys; the simulator's UUID-shape check does not prove entropy.

Claim and attempt are persisted together **before dispatch**. An initial response
and a current status read serve different purposes. A response lost after commit
is recovered by scoped lookup, then Order read, without dispatch. The client
blocks a fresh overlapping request while an attempt remains unresolved.

Provider absence is not proof of non-execution. A crash after a recorded dispatch
intent leaves `indeterminate`; a simulated authoritative operation record can
resolve it to committed or failed. No matching proof leaves it indeterminate.
The dispatched-index journal prevents approving a pending sibling from
redispatching an uncertain one. A missing creation response is not an execution
failure.

The local replay lifetime is 48h and the attempt-read lifetime is 30 days. Claims
and fence tombstones have no automatic expiry in the journal. Beyond attempt
retention, lookup/fence return unresolved `record_expired` and replay refuses;
expired data never becomes a no-commit assertion. These are simulator constants,
not required UCP retention periods.

Lookup/Get are strictly read-only and never install a claim/fence. Only explicit
fencing may create a durable tombstone for an **unclaimed** original key. A
claimed key returns its attempt or unresolved expiry. The fence operation has its
own scoped replay key. Late originals under a tombstone cannot dispatch. This
implements the design in #945 locally; no core UCP fence adoption is asserted.

## Financial finality

Cancellation updates active quantities to zero and derived status to `removed`,
while preserving original line identity/quantity and fulfillment event history.
Current-state reconciliation reads the Order; attempt results reference adjustments.
Original purchase totals are not repurposed as cash-refund evidence.

Current UCP adjustment status is `pending`, `completed`, or `failed`. The simulator
keeps an uncertain refund **pending** on the Order and represents uncertainty only
in its local observation view. It adds `occurred_at`, signed adjustment totals when
observed, and validates generated adjustments against pinned current-main schemas.
The provider-local refund breakdown can include original payment, loyalty and
store credit; it is not claimed as a standardized adjustment component schema.

The demo attributes 3000 to a cancelled unit, estimates 2700 refund, and later
observes 2650 across three methods. None of these numbers is substituted for
another. `UNKNOWN` carries no numeric amount. A determined zero requires an
explicit completed observation with amount 0. This is local evidence, not an SCQ
receipt, payment confirmation, or independent verification.

## Deliberate limits

This adapter is a single-writer local simulator with a JSON snapshot and process
restart tests. It has no distributed transactions, provider retries, cryptographic
authentication, live authorization revocation, event delivery or actual HTTP/MCP
discovery. Disk rename is not an fsync/power-loss durability guarantee. The fault
oracle, all policies, and all financial records are author-controlled fixtures.
The journal's single transaction across simulated Order/provider data must not be
read as an atomicity guarantee across real systems.
