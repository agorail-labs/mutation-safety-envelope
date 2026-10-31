# Contributing to Mutation Safety Envelope

Mutation Safety Envelope (MSE) is an experimental, independently developed research proposal and external-review candidate. Technical feedback, reproductions, counterexamples, and focused fixes are welcome. MSE is not an adopted standard or production certification.

## Before contributing

Read the [README](README.md), [normative specification](spec/normative-spec.md), [conformance guidance](docs/conformance.md), and [falsification notes](docs/falsification-notes.md). Open an issue describing the problem and affected version or commit before proposing a substantial normative or behavioral change.

## Evidence and review

Distinguish live observations, documentation-backed models, inferences, and unverified claims. Include a minimal reproduction and expected versus actual results. Simulator tests do not establish provider adoption or live-provider behavior. For normative changes, state the affected invariants, boundary cases, compatibility consequences, and unknown-outcome semantics; add negative tests when feasible.

Keep specification, schema, reference implementation, examples, and tests consistent. A discussion or pull request is not an acceptance or standardization decision until reviewed and merged.

## Local validation

```bash
npm install
npm test
npm run build
npm run validate-schema
```

Never include credentials or private customer data. For security-sensitive issues, follow [SECURITY.md](SECURITY.md) once published, or use a private contact method listed on the repository owner's GitHub profile. MSE is independent of UCP, ACP, and all named providers; do not imply their endorsement.
