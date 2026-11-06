# Stable-Candidate Review Package — MSE 1.0.0-rc.1 (prepared)

**Status: PREPARED — NO REVIEWER HAS BEEN CONTACTED.** Independent
review is a release gate (see `docs/RELEASE-QUALIFICATION.md`); this
package exists so that, when the maintainer authorizes outreach,
reviewers get a complete, self-contained assignment. Candidate
reviewers are identified in the SCQ repository's launch-materials
reviewer worksheet (internal planning document); prioritization
and contact are the maintainer's.

## What to evaluate

1. **API usability** — install the candidate, run the quickstart,
   and judge whether `evaluateAdmissionOnly` + the validators
   compose the way the API reference promises.
2. **Contract consistency** — `docs/STABLE-RELEASE-READINESS.md`
   §2–§3 against `docs/API-REFERENCE.md` and the actual behavior.
3. **Threat-model completeness** — `docs/SECURITY-AUDIT.md` plus
   your own probing of the validation boundary.
4. **Negative cases** — malformed/fabricated evidence, stale
   quotes, partial outcomes. The Phase 3 adversarial suite
   (`test/adversarial-stable-core.test.ts`) is the starting point,
   not the boundary of what to try.
5. **Package reproducibility** — build from source and compare the
   export surface against `docs/api/public-api.snapshot.json`.

## What counts as a substantive evaluation

A written report (issue, discussion, or document) with
**reproducible evidence**: commands, inputs, observed outputs, and
the commit/version evaluated. A star, a reaction, or an
unsupported opinion does not count, and merely being invited does
not count. Negative findings are as valuable as positive ones —
verified findings are recorded as evidenced, in the reviewer's own
conclusion.

## The candidate

- Source: the `release/1.0.0-rc.1-prep` branch (version bumped to
  `1.0.0-rc.1` in `package/package.json`), built with the prepared
  `release.yml` route when the maintainer authorizes an artifact.
- Gates and evidence: `docs/RELEASE-QUALIFICATION.md`.
