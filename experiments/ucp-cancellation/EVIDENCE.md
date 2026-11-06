# Evidence and reproducibility

All tests and simulator code are author-controlled. Results are local execution
evidence, **not independent validation, production adoption, or UCP conformance
certification**. External design comments and author tests are recorded separately.

## Source pins

| Source | Commit or state |
| --- | --- |
| UCP main | `852e33234d80d6bcac368ff4dc9a841631a6fbb2` |
| #945 cancellation contract | `1f6d526a1918bc072b49344ca8bbbddd948d7762`; open, unmerged, currently not Draft |
| Existing author-fork #5 test companion | `023de18367afe2bacacfca74af62d60393018761`; Draft |
| #890 purchase options | `e6ecae9a75f209b5446bc698d1b566b15dc04560`; open, unmerged |
| #1029 accepted-term architecture | `a38be0e7123aa8a21c9c52a2f9a79ca810a0056c`; open, unmerged |
| Independent #930 quote draft | `390ea57ca8e506bccf6ad5510ece497cc79fddff`; Draft, unmerged |
| MSE repository base | `a3c94f6c4d3b4bb3e80fb7bd64a6f07d4b1cb942` |
| SCQ repository | `8597852e918fb31e1470e4b5aa3b50fd2df00dcd` |
| UCP governance repository | `ddd1b3fed1c6ecdb205d10f3fb8af992859f929d` |
| Meeting minutes repository | `6d1b764283ac3d85a1187cbed4e3e4042c868a4d` |

Audited issues, PR status and independent #348 comments are preserved in
[evidence/upstream-state.json](evidence/upstream-state.json). Branch names are
mutable; use the reviewed commit and file hashes for reproduction. The commit
containing this document is the prototype pin (`git rev-parse HEAD`), avoiding a
self-referential hash inside the commit.

## Commands actually executed

From `experiments/ucp-cancellation`:

```bash
npm install --ignore-scripts --no-audit --no-fund
npm test
npm run demo
```

The final clean-install/test commands and output are recorded in
`evidence/verification.json`, `evidence/tests-final.txt`, and `evidence/demo.txt`.
Use the following reproduction commands in a fresh checkout:

```bash
cd experiments/ucp-cancellation
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run demo
```

The runner was Node `v24.22.1` on Linux. Exact direct dependencies are pinned in
`package.json`; transitive package versions and registry integrity are locked.
The published MSE package is the executable admission dependency. SCQ tarball
inspection is not reported as executing its test suite.

## Test evidence and corrected findings

Final suite: **48 passed, 0 failed, 0 skipped** (45 behavioral tests and 3 schema
tests). Final verification output is authoritative if the suite changes.

| Test group | What actually ran |
| --- | --- |
| P01–P02, N01–N10 | Capability gating, declared units, stale/unknown/unsupported distinctions, cancellation history, duplicate raw bytes, same-version concurrent calls, partial and atomic outcomes |
| N11–N16, N39–N40 | Merchant-review pending/declined/expired states, commit-time eligibility, competing reviews, whole-order review and atomic backend failure |
| N17–N22, N32–N34, N38, N41, N43 | Lost responses, strict read-only lookup, simulated process restarts, unknown provider proof, explicit fencing/retention, client overlap guard, hidden commit and no-redispatch regression |
| N23–N26 | Actual published MSE pass/refusal evidence; admission versus policy/authorization; replay and read ownership |
| N27–N31, N35–N37, N42 | Unknown/zero/split refund evidence, currency/integer checks, storage outage, malformed requests, open vocabulary and mutual parent/extension negotiation |
| S01–S03 | Generated request/declaration/attempt fragments checked against pinned #945 definitions; invalid atomic partial commit rejected; uncertain/final adjustments checked against current-main schema closure |

Development logs are preserved rather than silently replacing failed runs:

- First behavioral run: **39/39 passed**, before schema tests were added.
- Second run: **41 passed, 1 failed**. The read declaration lacked a required
  non-line `targets` reference. An empty-target attempt also failed. The fix uses
  a real fulfillment expectation with an explicitly experimental target type.
- Base-schema inspection found that `adjustment.status: unknown` would invent a
  value outside current UCP's enum. The implementation now keeps that adjustment
  pending and carries uncertainty only in local evidence; S03 verifies this.
- After adding N43, the probe produced **47 passed, 1 failed**: approving a
  pending sibling caused **3 dispatches instead of 2**, redispatching an uncertain
  unit. Persisted dispatched indices now exclude it from approval execution.
  The corrected suite passes **48/48**, including that exact reproducer.

No result above is a new count for fork #5. Its historical 313 checks and 24
structural vectors were inspected, not rerun or relabeled here. `ucp-schema` was
not available, so this work does not claim UCP annotation-resolution, docs build,
REST/MCP descriptor validation, or all 24 existing runtime vectors executed.
The schema subset bundle retains upstream definitions with only the amount ref
localized; [schema-origin.json](evidence/schema-origin.json) records its source
hash. It is not a generated or published full UCP schema.

## Limits and unverified assumptions

- In-process serialized JavaScript execution, one writer per journal; concurrency
  tests are concurrent client calls into that simulator, not multiple servers.
- Restart tests reopen saved snapshots and inject exceptions at known boundaries.
  They do not establish power-loss durability, filesystem integrity, real remote
  commit evidence, exactly-once execution, or cross-system atomicity.
- Authentication contexts, Business review, dependencies, policy, currency,
  prices, financial allocations and provider operation records are fixtures.
  Actual OAuth, HTTP signatures, credential secrecy, authority revocation during
  review, provider integrations and notifications remain unimplemented.
- The client tracks unresolved attempts in memory. A production client must
  persist its own original key/body and unresolved overlap journal across restart.
- Fulfillment is projected only enough to exercise cancellation and eligibility;
  real expectation restructuring, discounts, partial fulfilled-unit cancellation,
  and accounting exports require domain implementation.
- UUID-shape acceptance is not an entropy proof. Registry SHA-512 comparison is
  byte integrity verification, not npm signing-key or provenance verification.
- Cafe24/Weston feedback is about upstream design, not this prototype. No external
  implementer or maintainer reviewed this technical package during this run.

All changes live under this experiment on a separate branch. No npm release,
real payment/billing mutation, upstream post, reviewer request, or merge is part
of the work. The only authorized publication is an author-controlled Draft PR.
