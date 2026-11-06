import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { evaluateAdmissionOnly } from "../src/core/admission-only";
import {
  MseViolation,
  assertAdmissionReportWellFormed,
  assertQuoteUnitsWellFormed,
  deriveSatisfactionRealization,
  isQuoteExpired,
} from "../src/core/validate";
import type {
  AdmissionReport,
  AdmissionSatisfaction,
  CommitResult,
  MutationProposal,
  MutationQuote,
  SuccessfulAdmissionReport,
} from "../src/core/types";

// Adversarial tests for the proposed stable core (Stable Release
// Engineering Program, Phase 3). Each test names the guarantee it
// pins; guarantees are stated in docs/STABLE-RELEASE-READINESS.md §3.

const passFixture = JSON.parse(readFileSync(new URL("../examples/retail/amended-quote.fixture.json", import.meta.url), "utf8")) as {
  quote: MutationQuote;
  commitResponse: { admissionReport: SuccessfulAdmissionReport };
};
const passProposal: MutationProposal = {
  proposalId: passFixture.commitResponse.admissionReport.proposalId,
  target: passFixture.quote.target,
  change: { transitions: passFixture.quote.units.map(u => u.transition) },
};
const report = passFixture.commitResponse.admissionReport;

describe("malformed or untrusted evidence is rejected, never repaired", () => {
  it("assertAdmissionReportWellFormed throws MseViolation on non-objects and empty objects", () => {
    expect(() => assertAdmissionReportWellFormed(passFixture.quote, passProposal, null as never)).toThrow(MseViolation);
    expect(() => assertAdmissionReportWellFormed(passFixture.quote, passProposal, {} as never)).toThrow(MseViolation);
  });

  it("assertAdmissionReportWellFormed throws on a fabricated coverage status", () => {
    const forged = {
      ...report,
      coverage: report.coverage.map(c => ({ ...c, status: "SOMETIMES" })),
    } as unknown as AdmissionReport;
    expect(() => assertAdmissionReportWellFormed(passFixture.quote, passProposal, forged)).toThrow(MseViolation);
  });

  it("assertQuoteUnitsWellFormed throws MseViolation (not TypeError) on a null quote", () => {
    expect(() => assertQuoteUnitsWellFormed(null as never)).toThrow(MseViolation);
    expect(() => assertQuoteUnitsWellFormed({} as never)).toThrow(MseViolation);
  });

  it("assertQuoteUnitsWellFormed throws on duplicate unitRefs", () => {
    const quote = passFixture.quote;
    const dup = { ...quote, units: [quote.units[0], quote.units[0]] } as MutationQuote;
    expect(() => assertQuoteUnitsWellFormed(dup)).toThrow(MseViolation);
  });

  it("evaluateAdmissionOnly throws when the evaluator returns malformed evidence", () => {
    expect(() => evaluateAdmissionOnly(passProposal, passFixture.quote, () => ({ coverage: "yes" }) as never)).toThrow(MseViolation);
    expect(() => evaluateAdmissionOnly(passProposal, passFixture.quote, () => null as never)).toThrow(MseViolation);
  });
});

describe("admission is not execution or authorization", () => {
  it("a PASSED decision contains no execution-shaped keys at any depth", () => {
    const decision = evaluateAdmissionOnly(passProposal, passFixture.quote, () => ({
      coverage: report.coverage, failures: [], stateRef: report.stateRef,
    }), new Date(report.evaluatedAt));
    expect(decision.kind).toBe("ADMISSION_PASSED");
    const banned = /commit|receipt|finality|dispatch|executed|authorized/i;
    const walk = (v: unknown, path: string): void => {
      if (v && typeof v === "object") {
        for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
          expect(banned.test(k), `execution-shaped key at ${path}.${k}`).toBe(false);
          walk(val, `${path}.${k}`);
        }
      }
    };
    walk(decision, "decision");
  });
});

describe("stale evidence does not satisfy a current requirement", () => {
  it("isQuoteExpired: past expiry is expired, future is not, absent never expires", () => {
    const now = new Date("2026-11-05T00:00:00.000Z");
    expect(isQuoteExpired({ ...passFixture.quote, expiresAt: "2026-11-04T23:59:59.000Z" }, now)).toBe(true);
    expect(isQuoteExpired({ ...passFixture.quote, expiresAt: "2026-11-05T00:00:01.000Z" }, now)).toBe(false);
    expect(isQuoteExpired({ ...passFixture.quote, expiresAt: undefined }, now)).toBe(false);
  });
});

describe("partial or unknown outcomes never become global success", () => {
  const satisfierUnit = report.coverage.find(c => "satisfactions" in c && !!c.satisfactions?.length && c.satisfactions[0].source === "CURRENT_REQUEST")
    ? report.coverage.flatMap(c => ("satisfactions" in c ? (c.satisfactions ?? []) : [])).find(s => s.source === "CURRENT_REQUEST")
    : undefined;
  // Cover every CURRENT_REQUEST satisfaction in the report; vary only
  // the target unit's outcome so no satisfaction is left uncorrelated
  // (an uncorrelated satisfaction correctly throws — see the last test).
  const allSatisfierRefs: string[] = [];
  for (const c of report.coverage) {
    if (!("satisfactions" in c) || !c.satisfactions) continue;
    for (const s of c.satisfactions as AdmissionSatisfaction[]) {
      if (s.source === "CURRENT_REQUEST") allSatisfierRefs.push(s.unitRef);
    }
  }
  const unitResultFor = (ref: string, outcome: "APPLIED" | "REFUSED" | "INDETERMINATE"): CommitResult["unitResults"][number] =>
    outcome === "APPLIED"
      ? { unitRef: ref, outcome, committedEffects: [] }
      : outcome === "REFUSED"
        ? { unitRef: ref, outcome, refusalReason: "PROVIDER_REJECTED" }
        : { unitRef: ref, outcome, reconciliation: { mode: "NONE" } };
  const withResult = (targetOutcome: "APPLIED" | "REFUSED" | "INDETERMINATE"): CommitResult => ({
    quoteId: report.quoteId,
    unitResults: allSatisfierRefs.map(ref =>
      unitResultFor(ref, satisfierUnit && ref === satisfierUnit.unitRef ? targetOutcome : "APPLIED")),
    aggregateHint: "MIXED",
  });
  const emptyResult: CommitResult = { quoteId: report.quoteId, unitResults: [], aggregateHint: "MIXED" };

  it("an INDETERMINATE satisfier outcome derives an INDETERMINATE realization, allRealized=false", () => {
    if (!satisfierUnit || satisfierUnit.source !== "CURRENT_REQUEST") return;
    const derived = deriveSatisfactionRealization(report, withResult("INDETERMINATE"));
    const entry = derived.entries.find(e => e.unitRef === satisfierUnit.unitRef);
    expect(entry?.realization).toBe("INDETERMINATE");
    expect(derived.allRealized).toBe(false);
  });

  it("a REFUSED satisfier outcome derives NOT_REALIZED, allRealized=false", () => {
    if (!satisfierUnit || satisfierUnit.source !== "CURRENT_REQUEST") return;
    const derived = deriveSatisfactionRealization(report, withResult("REFUSED"));
    expect(derived.entries.find(e => e.unitRef === satisfierUnit.unitRef)?.realization).toBe("NOT_REALIZED");
    expect(derived.allRealized).toBe(false);
  });

  it("a satisfaction citing a unit with no execution outcome throws instead of assuming success", () => {
    if (!satisfierUnit || satisfierUnit.source !== "CURRENT_REQUEST") return;
    expect(() => deriveSatisfactionRealization(report, emptyResult)).toThrow(MseViolation);
  });

  it("an evidence-free passed report realizes nothing: allRealized=false (non-vacuous)", () => {
    const bare: SuccessfulAdmissionReport = { ...report, coverage: report.coverage.map(c => ({ relationId: c.relationId, status: "PASSED" as const })) };
    const derived = deriveSatisfactionRealization(bare, emptyResult);
    expect(derived.entries).toEqual([]);
    expect(derived.allRealized).toBe(false);
  });
});
