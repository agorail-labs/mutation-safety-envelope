# Draft follow-up for existing #348 — NOT POSTED

The cancellation-first contract is already tracked in #943 and its focused
specification/transport PR #945. I have added an [isolated executable companion](https://github.com/agorail-labs/mutation-safety-envelope/pull/25)
to exercise the behavior, rather than opening a competing proposal.

The prototype covers whole-order and declared-unit cancellation, immediate and
merchant-reviewed processing, atomic/per-unit commitment, stale versions,
raw-byte idempotency conflicts, lost-response lookup, process restart and
uncertain refunds. Its 48 tests pass. It uses local simulators only. Cafe24's merchant-review input
and Weston's declared-unit requirement inform the scenarios; neither has tested
or endorsed this implementation.

The behavior that seems most useful to review first is:

- A pending Business decision is distinct from an indeterminate execution.
- A lookup is read-only and a missing record does not prove non-execution.
- Cancellation commitment is separate from financial adjustment completion.

Could the Shopping maintainers confirm the existing optional Orders/cancel-first
boundary, and identify which of #945's operation-discovery and claim/fence
retention choices should be resolved first? In particular, should this extension
continue to add gated operations to the shared Shopping descriptors, and is the
proposed durable claim/fence guarantee acceptable, or should an implementation
that cannot maintain it explicitly remain unresolved?

No Agorail dependency, generic mutation schema, new payment operation, or change
to #890's Purchase Options scope is requested. I can map the resulting decisions
back to the existing #943/#945 contract and its companion tests.

---

No upstream issue, comment, reviewer request, or PR was
created by this package. The link is supporting evidence, not a request to adopt
MSE/SCQ or merge an unapproved extension.
