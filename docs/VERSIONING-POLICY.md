# Compatibility and Versioning Policy (proposed for 1.0)

**Status: PROPOSED — takes effect only if and when a stable 1.0 is
approved.** The current published line is experimental
(`0.4.0-experimental.1`) and carries no compatibility promise.

## Three versions, kept distinct

| Version | Where it lives | Notes |
|---|---|---|
| Package version | `package/package.json`, npm | Governed by this policy |
| Repository source version | root `package.json` (`0.4.0-dev.0`) | Development-line label; the published snapshot proved to be the *same code* (see the readiness document, B-MSE-1), but the labels remain distinct on purpose |
| Specification version | in-repo spec documents | Versioned separately; a package release never renames the spec |

## Semantic versioning for the package (from 1.0)

- **MAJOR** — removing or renaming an export, narrowing a type,
  changing a documented behavioral guarantee (readiness §3),
  changing the schema in a way that rejects previously valid
  documents, or raising the minimum Node version.
- **MINOR** — backward-compatible additions: new exports, new
  optional fields, schema additions that keep prior documents
  valid.
- **PATCH** — bug fixes restoring documented behavior, security
  fixes, documentation.

## Enforcement

1. **API surface snapshot** (`docs/api/public-api.snapshot.json`)
   with a CI drift test — any surface change is a deliberate,
   reviewed act.
2. **Schema validation** in CI (ajv strict) plus the release
   workflow's clean-consumer installation of the exact tarball.
3. **Behavioral regression suite**, including the Phase 3
   adversarial tests for the stable-core guarantees.

## Deprecation

Deprecated surfaces remain functional for at least one MAJOR line
after a replacement ships, with migration notes published before
removal.
