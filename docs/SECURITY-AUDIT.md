# Security and Supply-Chain Audit — MSE

**Date:** 2026-11-05 · **Scope:** repository at `ea8601e` and the
published `@agorail-labs/mse-reference@0.4.0-experimental.1`
artifact. Part of the Stable Release Engineering Program, Phase 4.
Method: `npm audit`, tracked-file credential scan, workflow review,
published-tarball content inspection, local matrix runs.

## Findings

| ID | Finding | Severity | Disposition |
|---|---|---|---|
| S-MSE-1 | 8 `npm audit` vulnerabilities (2 critical, 2 high, 4 moderate), **all in the dev-only vitest 2.x toolchain** (vite, esbuild, tinypool, @vitest/mocker). The published package has **zero runtime dependencies**; none of these ship. Risk is to developer machines running the dev server/UI. | Moderate (dev-only) | **Fixed in this PR:** vitest ^2 → ^5.1.0, `@types/node` ^20 → ^22, lockfile regenerated. Post-fix audit: **0 vulnerabilities**; suite 313/313, build and schema validation green. One migration catch, also fixed here: vitest 5 collects compiled tests under `dist/` after a build (double-counting and failing on fixture paths); `vitest.config.ts` now pins the `dist/**` exclusion explicitly, verified green before and after `npm run build`. |
| S-MSE-2 | No `SECURITY.md`; no documented reporting route. | Low | **Fixed in this PR** (`SECURITY.md`). Enabling GitHub private vulnerability reporting is a repository-admin action — see checklist. |
| S-MSE-3 | `mse-package.yml` carried no `permissions:` block (default token permissions). | Low | **Fixed in this PR:** `contents: read`. `ci.yml` already declared `contents: read`. |
| S-MSE-4 | Validators leaked raw `TypeError` on null input (error-contract break on the untrusted-input boundary). | Low | Fixed in the Phase 3 PR (entry guards, F-MSE-1). |
| S-MSE-5 | Actions are pinned by major version (`@v4`/`@v7`), not commit SHA. | Info | Recorded; SHA pinning is a maintainer-policy decision, not changed unilaterally here. |

## Verified clean

- **Credential scan:** no credential-shaped strings in tracked
  files (tests, fixtures, examples included in the scan scope).
- **Published tarball:** 14 files — `dist/`, the JSON Schema,
  README, LICENSE, `package.json`. No test files, no credentials,
  no unexpected content.
- **Runtime dependency surface:** none. The package imports only
  Node builtins.
- **Input handling:** the validators are the trust boundary; Phase 3
  adversarial tests pin rejection behavior, including non-object
  input after the F-MSE-1 fix.

## Administrator checklist (requires repo/org admin; not done here)

1. Enable **private vulnerability reporting** (Settings → Security).
2. Enable **Dependabot alerts** and security updates.
3. Confirm **branch protection** on `main`: required status checks
   (CI matrix), no force pushes, no direct pushes.
4. Configure the **npm trusted publisher** for the prepared
   `release.yml` before any future publish (see that file's header).
5. Confirm maintainer accounts use hardware-key 2FA (the npm
   account already requires security-key 2FA for writes).

## OpenSSF Best Practices — self-assessment (not a certification)

| Criterion area | State |
|---|---|
| Description, license, contribution guidance | Satisfied (README, LICENSE, CONTRIBUTING) |
| Version control, public repo, issue tracking | Satisfied |
| Build + automated tests in CI | Satisfied (matrix 22/24/26 after this PR) |
| Vulnerability reporting process | Satisfied after this PR + admin step 1 |
| Dependency vulnerability scanning | Partial — `npm audit` is manual; Dependabot enablement is admin step 2 |
| Signed releases / provenance | Not yet — prepared `release.yml` (OIDC + provenance) is the path; no release has used it |
| Crypto, credentials in repo | Satisfied (none; zero runtime deps) |

No badge or certification is claimed.
