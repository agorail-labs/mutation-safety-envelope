# Release Qualification — MSE 1.0.0-rc.1 (candidate)

**Candidate:** `@agorail-labs/mse-reference@1.0.0-rc.1` — PREPARED,
NOT PUBLISHED. **Base commit:** `ea8601e` (main) plus this program's
PRs 1–5. **Date:** 2026-11-05. Evidence references are to documents
and tests in this repository (paths) and to dated local matrix runs
recorded during the program; each gate names its own evidence —
nothing is inferred from an unrelated historical result.

## Gate table

| Gate | Status | Evidence |
|---|---|---|
| Stable API defined | PASS | `docs/STABLE-RELEASE-READINESS.md` §2 (stable core), `docs/API-INVENTORY.md` |
| Compatibility verified | PASS | Export surface identical to the published artifact (8 values, 42 types; extraction 2026-11-05); snapshot drift test; `docs/MIGRATION-GUIDE.md` (one behavioral fix, disclosed) |
| Security review | PASS (internal) | `docs/SECURITY-AUDIT.md`: audit 8→0 vulnerabilities (dev toolchain), secret scan clean, tarball inspection clean, zero runtime dependencies. Independent security review is counted under Independent review, not here |
| Failure recovery verified | PASS | MSE holds no state and executes nothing; its failure contract is fail-closed rejection, pinned by `test/adversarial-stable-core.test.ts` (11 tests) plus the existing suite |
| Maintained Node LTS support | PASS | Clean `npm ci` matrix at the qualification base: suite 313/313 + build + schema validation on Node 22.14.0, 24.22.x, 26.13.0 (2026-11-05) |
| Clean-room install | PASS | Published package installed exact-version and the unified Agorail example run green on Node 22/24/26 (2026-11-05/06 runs) |
| Supply-chain integrity | PASS | Published artifact is CI-attested (org attestation workflow, recorded SHA-256 pin); candidate route is the prepared OIDC `release.yml` with provenance; no long-lived npm token |
| Operational documentation | PASS | `docs/API-REFERENCE.md`, `docs/VERSIONING-POLICY.md`, `docs/MIGRATION-GUIDE.md`, `docs/SUPPORT.md`, `SECURITY.md` |
| Independent review | **PENDING** | Review package prepared (`docs/STABLE-CANDIDATE-REVIEW.md`); no reviewer contacted (not authorized); zero substantive evaluations received |
| Maintainer approval | **PENDING** | Awaiting the maintainer's decision on the stable scope and this qualification |

## Known limitations of the candidate

- `ReferenceProvider` remains reference scaffolding, not a stable
  production surface (classified, documented).
- No independent evaluation exists yet; all PASS marks above are
  maintainer-side evidence.

## Recommendation

**GO for 1.0.0-rc.1 as a review candidate** (publishable as an RC
only through the prepared release workflow, on the maintainer's
separate authorization). **NO-GO for 1.0.0 stable** until the two
PENDING gates close: at least two substantive independent
evaluations (one adversarial) and explicit maintainer approval.
Nothing about the RC changes any public maturity claim: until
then, the project remains experimental.
