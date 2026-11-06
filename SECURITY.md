# Security Policy

## Reporting a vulnerability

Report vulnerabilities privately through GitHub's private
vulnerability reporting for this repository (**Security → Report a
vulnerability**). Do not open a public issue for a suspected
vulnerability. If private reporting is unavailable, contact the
maintainer through the GitHub organization page and ask for a
private channel — do not include exploit details in a public post.

We aim to acknowledge a report within 5 business days and to agree
on a disclosure timeline with the reporter. Coordinated disclosure
is the default.

## Supported versions

| Version | Support |
|---|---|
| `@agorail-labs/mse-reference@0.4.0-experimental.1` | Experimental — security reports accepted and triaged; no SLA |
| Repository source (`0.4.0-dev.0`) | Best-effort |

A supported-versions table with fix SLAs takes effect only with a
stable (1.x) release and its maintenance policy.

## Scope notes

MSE is a pure admission-evaluation library: it performs no network
I/O, holds no credentials, executes nothing, and has **zero runtime
dependencies**. The realistic vulnerability classes are malformed-
input handling (validation must throw `MseViolation`, never crash
with an uncontrolled error or coerce acceptance), denial of service
through pathological inputs to validation/canonicalization, and
supply-chain compromise of the published artifact. Reports in those
classes are in scope; reports that amount to "admission is not
authorization" describe the documented design, not a vulnerability.
