# Cancellation-first UCP integration experiment

**Experimental, author-controlled, simulator-backed. No UCP adoption or independent validation is claimed.**

This isolated package exercises the cancellation contract already proposed in
[EP #943](https://github.com/Universal-Commerce-Protocol/ucp/issues/943) and
[PR #945](https://github.com/Universal-Commerce-Protocol/ucp/pull/945), originating in
[#348](https://github.com/Universal-Commerce-Protocol/ucp/issues/348).
It adds executable evidence; it does not propose a competing extension.

Requires Node >=22. From this directory:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run demo
```

Only the published `@agorail-labs/mse-reference@1.0.0-rc.2` admission entry point
is used. The parent repository's unpublished source is not imported or built.
SCQ 1.0.0-rc.2 was inspected and its registry bytes verified; it is deliberately
not a cancellation or refund dependency.

| Read first | Purpose |
| --- | --- |
| [UCP_EXTENSION_BOUNDARY.md](UCP_EXTENSION_BOUNDARY.md) | Current upstream audit, options, recommendation, blockers |
| [CANCELLATION_CONTRACT.md](CANCELLATION_CONTRACT.md) | Minimal semantics and experimental adapter boundary |
| [AGORAIL_INTEGRATION.md](AGORAIL_INTEGRATION.md) | Actual package use, exclusions, subscription follow-on |
| [UPSTREAM_PROPOSAL_DRAFT.md](UPSTREAM_PROPOSAL_DRAFT.md) | Unposted follow-up for #348/#943 |
| [EVIDENCE.md](EVIDENCE.md) | Pins, commands, actual results, limitations |

`src/simulator.mjs` is an in-process Business simulator and a read-first client.
It persists a single JSON journal, uses explicit fault injection, and never contacts a
payment, billing, or merchant API. `com.example.order_modification` is a **reserved
example namespace**, not a registered or hosted Agorail capability. Its version and
lightweight profile arrays are local test metadata, not production UCP discovery.
All operation methods and wire examples here are experimental.

The root package, npm publication, existing `ucp-binding/README.md`, and upstream
UCP files remain outside this experiment. The older generic MSE binding sketch is
not the architecture recommended by this cancellation investigation.
