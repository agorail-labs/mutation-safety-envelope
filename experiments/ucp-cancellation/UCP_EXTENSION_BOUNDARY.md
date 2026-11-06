# UCP extension boundary

Audit date: November 6, 2026. Recommendation: continue the **optional cancellation
extension of Orders already tracked by EP #943 / PR #945**, composing existing
authorization, Order state and adjustments. Do not propose an MSE capability or
require Agorail to implement the protocol.

## Current upstream baseline

The audited UCP main is `852e33234d80d6bcac368ff4dc9a841631a6fbb2`.
Use the pinned links below to distinguish merged main from proposed work.

| Surface | Observed state | Consequence |
| --- | --- | --- |
| [Orders on pinned main](https://github.com/Universal-Commerce-Protocol/ucp/blob/852e33234d80d6bcac368ff4dc9a841631a6fbb2/docs/specification/shopping/order/index.md) | Order read, webhooks, line history, fulfillment, adjustments; `order:manage` anticipates cancellation but supplies no cancellation operation | Read/reporting primitives do not implement a mutation contract |
| [#348](https://github.com/Universal-Commerce-Protocol/ucp/issues/348) | Open; Weston and Cafe24 supplied external design input | Declare units before writes; distinguish business review from unknown execution |
| [#943](https://github.com/Universal-Commerce-Protocol/ucp/issues/943) / [#945](https://github.com/Universal-Commerce-Protocol/ucp/pull/945) | Existing cancellation-first EP and unmerged five-file specification/transport proposal; #945 is currently **not Draft** | This work is an execution companion, not a new EP; no change to that PR's status is authorized here |
| [Fork #5](https://github.com/arjun2075/ucp/pull/5) | Draft companion at `023de18367afe2bacacfca74af62d60393018761`; existing fixture/model tests and 24 structural vectors | Do not relabel historical model checks as a runtime merchant implementation |
| [#890](https://github.com/Universal-Commerce-Protocol/ucp/pull/890) | Open, unmerged; `e6ecae9a75f209b5446bc698d1b566b15dc04560`; stacked on payment changes #987 | Purchase options and subscription policy establish future recurring-order terms, not a management API |
| [#845](https://github.com/Universal-Commerce-Protocol/ucp/issues/845) / [#1029](https://github.com/Universal-Commerce-Protocol/ucp/pull/1029) | Open architecture review of accepted-term handoff | Reuse authority/scope reasoning; cancellation does not require an accepted-terms artifact |
| [#929](https://github.com/Universal-Commerce-Protocol/ucp/issues/929) / [#930](https://github.com/Universal-Commerce-Protocol/ucp/pull/930) | Independent unmerged price-only quote extension, #930 Draft | Do not replace with SCQ or use Cart/Checkout quote acceptance to mutate completed Orders |
| [#947](https://github.com/Universal-Commerce-Protocol/ucp/issues/947) | B2B charter; a GC representative reports approval and nominations as next step | Coordinate procurement-specific requirements; charter approval is not approval of cancellation semantics |
| [#944](https://github.com/Universal-Commerce-Protocol/ucp/issues/944) / [#946](https://github.com/Universal-Commerce-Protocol/ucp/pull/946) | Separate Business-initiated consultation proposal; #946 Draft | A buyer cancellation request is not a new buyer-authorization consultation |
| [#848](https://github.com/Universal-Commerce-Protocol/ucp/pull/848), [#641](https://github.com/Universal-Commerce-Protocol/ucp/issues/641), [#843](https://github.com/Universal-Commerce-Protocol/ucp/pull/843) | Unmerged guest credential, Order Actions/collection, and adjustment-vocabulary proposals | Keep guest-token support, generic Actions on Orders, and new adjustment meanings out of the baseline |

### External input, with bounded attribution

[Weston's comment](https://github.com/Universal-Commerce-Protocol/ucp/issues/348#issuecomment-5572815428)
describes his independently reversible settlement units, exact integer allocation,
retained delivery, and collapse to pooled settlement when allocation cannot be
reconstructed. The reusable requirement is **Business-declared reversibility**,
not a universal rule that pooled capture prevents partial cancellation or refunds.
The simulator makes no inference from line count or payment capture layout.

[Cafe24's comment](https://github.com/Universal-Commerce-Protocol/ucp/issues/348#issuecomment-6121415220)
supports the optional Orders/cancel-first direction and explains immediate versus
merchant-reviewed cancellation, shipment-dependent eligibility, and estimates that
differ from final refunds or split across payment, loyalty, and credit. It offers
to check a contract against flows. That is independent **design feedback** on
#348; Cafe24 has not tested this prototype, validated Agorail, or adopted it.

### Council and governance review

The [October 30 Shopping minutes](https://github.com/Universal-Commerce-Protocol/meeting-minutes/blob/6d1b764283ac3d85a1187cbed4e3e4042c868a4d/tc/shopping/2026/2026-10-30.md)
schedule purchase-options/split-payments review; the
[October 22 Payments minutes](https://github.com/Universal-Commerce-Protocol/meeting-minutes/blob/6d1b764283ac3d85a1187cbed4e3e4042c868a4d/tc/payments/2026/2026-10-22.md)
discuss instrument compatibility and vaulting for #890. Neither is cancellation
approval. The [October 30 GC minutes](https://github.com/Universal-Commerce-Protocol/meeting-minutes/blob/6d1b764283ac3d85a1187cbed4e3e4042c868a4d/gc/2026/GC-2026-10-30.md)
record B2B council composition/continuity work; read together with the later
approval update in #947, without assuming the council is already seated.

[Contribution rules](https://github.com/Universal-Commerce-Protocol/ucp/blob/852e33234d80d6bcac368ff4dc9a841631a6fbb2/docs/documentation/contributing.md)
favor publisher namespaces for emerging extensions and allow illustrative Draft PRs.
An EP requires DTC approval to reach Provisional; implementation is not adoption.
No approval or graduation was established for #943 during this audit.

## Architectural comparison

| Choice | Strength | Cost or gap | Decision |
| --- | --- | --- | --- |
| Optional Orders extension | Natural owner of cancellation, declared units, current quantities, existing manage scope, adjustments; matches #348/#943 and Cafe24 | Requires new attempt operations, discovery placement, retention and notification decisions | **Recommend for cancellation** |
| Separate post-purchase capability | Could eventually group returns, exchanges, and long-lived agreement management | Duplicates Order addressing/authorization now; forces common lifecycle before domain evidence; no approved generic management surface found | Defer broad abstraction; consider a separate subscription lifecycle later |
| Existing Orders + Actions + auth + adjustments alone | Reuses reporting, identity, and extensibility | Orders do not currently adopt Actions; Actions carry extension-defined outstanding work, not a generic executor, durable attempt or cancellation authorization | Compose these primitives inside an extension where applicable; composition alone does not close the gap |

The [Actions contract](https://github.com/Universal-Commerce-Protocol/ucp/blob/852e33234d80d6bcac368ff4dc9a841631a6fbb2/docs/specification/overview/index.md#actions)
requires each parent to explicitly adopt Actions. Merchant review is Business work,
not automatically an Action for the Platform. Reusing an existing webhook as an
update hint is plausible; a webhook is not a new cancellation command or proof
that an exact attempt committed.

## Remaining standardization blockers

1. **Operation discovery and namespace authority.** #945 puts operations in the
   shared Shopping descriptors because current registry semantics do not attach an
   extension-specific descriptor. Maintainers must choose that placement or a new
   supported discovery mechanism. `dev.ucp.*` is not granted by a prototype.
2. **Preconditions and authorization.** #945 currently uses `base_order_version`
   consistently across REST/MCP, not ETag/If-Match. Decide scope coverage for
   mutation, attempt reads, and fencing; guest authority depends on separate work.
3. **Durable identity versus replay lifetime.** Existing UCP requires at least 24h
   replay retention, while #945 proposes longer attempt retention and permanent
   claim/fence markers while Orders accept modifications. This is a real
   operational requirement, not something MSE supplies.
4. **Business-review lifecycle.** Set or expose a review deadline, define refusal
   on expiry and commit-time eligibility revalidation, and choose notifications.
   The prototype's 1h deadline is an explicit fixture assumption, not UCP policy.
5. **Non-line targets and financial evidence.** Decide how units reference retained
   fulfillment components. Current adjustments have `pending/completed/failed`;
   an uncertain settlement must not invent a core `unknown` status. Split tender
   and estimate-to-actual evidence may need domain-specific reporting.
6. **Implementation evidence and graduation.** Need independently implemented
   Business/Platform tests, real authorization, durable multi-process execution,
   and merchant validation. The current author-controlled simulator establishes
   none of those by itself.

The smallest next review is the existing Orders/cancel-first boundary plus the
attempt-reconciliation retention/discovery decisions. Full generic mutation
infrastructure is not a prerequisite for that review.
