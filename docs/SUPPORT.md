# Support Matrix and Platform Notes (stable candidate)

**Status: PROPOSED for the 1.0 candidate.**

## Supported runtimes (candidate)

| Runtime | Suite | Build | Schema validation | Package smoke |
|---|---|---|---|---|
| Node 22 LTS | ✅ 313/313 | ✅ | ✅ | ✅ (via SCQ consumer runs) |
| Node 24 LTS | ✅ 313/313 | ✅ | ✅ | ✅ |
| Node 26 LTS | ✅ 313/313 | ✅ | ✅ | ✅ |

All runs are clean `npm ci` installs at the qualification commit.
Node 20 and older: **not supported** (`engines: node >=22`).

## Platforms

Linux x86_64 is the validated platform (local matrix + CI).
MSE is a pure, dependency-free TypeScript library with no I/O,
no native code, and no platform-specific behavior; other platforms
are expected to behave identically but are not separately claimed.

## What an application can safely rely on (candidate contract)

The readiness document §3: fail-closed admission, evidence
validation that rejects rather than repairs, refusal witnesses for
missing co-inclusion, no execution semantics in an admission pass,
non-vacuous realization derivation, and unknown finality that is
never promoted.

## What remains the integrating application's responsibility

- **Authorization.** Admission answers "is this change-set
  complete and admissible against its evidence?" — never "may
  this actor do it?"
- **Execution.** MSE dispatches nothing. Executing an admitted
  change, and doing so safely, is your layer.
- **Evidence authenticity.** Validators check evidence *shape and
  correlation*; whether the evidence's origin is trustworthy is
  established by your binding/evaluator, not by MSE.
- **Freshness policy.** MSE exposes quote expiry; how stale is
  too stale for your domain is your policy.
