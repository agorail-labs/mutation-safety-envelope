# Migration Guide — experimental.1 → stable candidate

For consumers of `@agorail-labs/mse-reference@0.4.0-experimental.1`
moving to the stable candidate (1.0.0-rc.1, prepared — not yet
released).

## 1. Node.js >= 22 is required

The candidate declares `engines: node >=22` and is validated on
Node 22, 24, and 26 LTS (suite, build, schema validation, and the
package smoke test on each). Node 20 and older are not supported.
The package has zero runtime dependencies, so no native-module or
transitive-dependency migration exists.

## 2. The version-label distinction goes away

You may have seen the repository describe its source as
`0.4.0-dev.0` while npm served `0.4.0-experimental.1`, implying
divergence. The qualification audit enumerated it: the newest
source commit is the published artifact's own release-prep commit
and the export surfaces are identical — **there is no code
divergence to migrate across**. From 1.0, the source and package
versions are cut together by the release workflow, and the
versioning policy keeps package, source, and spec versions
explicitly distinct.

## 3. API changes

- **None to export names or shapes.** The candidate's surface is
  machine-checked identical to the published artifact (8 values,
  42 types).
- **Error-contract tightening (behavioral fix):** the validators
  `assertAdmissionReportWellFormed` and
  `assertQuoteUnitsWellFormed` previously leaked a raw `TypeError`
  on null/non-object input; they now throw `MseViolation`, as
  every other validator in the module already did. If you catch
  validation failures by error type, catch `MseViolation` — that
  was always the documented contract; the leak was the bug.
- `ReferenceProvider` is classified as reference scaffolding. It
  keeps working, but plan on it as test/example infrastructure,
  not a production integration surface.

## 4. What did not change

Admission semantics, refusal witnesses, realization derivation,
the JSON Schema's accepted documents, and the guarantee that
admission is not authorization and not execution.
