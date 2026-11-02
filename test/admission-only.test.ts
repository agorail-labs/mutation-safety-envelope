import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { evaluateAdmissionOnly } from "../src/core/admission-only";
import type { MutationQuote, MutationProposal, AdmissionRefusal, SuccessfulAdmissionReport } from "../src/core/types";

const passFixture = JSON.parse(readFileSync(new URL("../examples/retail/amended-quote.fixture.json", import.meta.url), "utf8")) as {
  quote: MutationQuote;
  commitResponse: { admissionReport: SuccessfulAdmissionReport };
};
const failFixture = JSON.parse(readFileSync(new URL("../examples/retail/admission-refusal.fixture.json", import.meta.url), "utf8")) as {
  proposal: MutationProposal;
  quote: MutationQuote;
  commitResponse: { admissionRefusal: AdmissionRefusal };
};
const passProposal: MutationProposal = {
  proposalId: passFixture.commitResponse.admissionReport.proposalId,
  target: passFixture.quote.target,
  change: {
    transitions: passFixture.quote.units.map(u => u.transition),
  },
};

describe("external durable-executor admission-only handoff", () => {
  it("returns validated PASSED evidence without calling any commit/dispatch callback", () => {
    const expected = passFixture.commitResponse.admissionReport;
    let reads = 0;
    const decision = evaluateAdmissionOnly(passProposal, passFixture.quote, () => {
      reads++;
      return { coverage: expected.coverage, failures: [], stateRef: expected.stateRef };
    }, new Date(expected.evaluatedAt));
    expect(decision.kind).toBe("ADMISSION_PASSED");
    if (decision.kind === "ADMISSION_PASSED") expect(decision.admissionReport).toEqual(expected);
    expect(reads).toBe(1);
  });

  it("returns a genuine refusal and repair witness before any executor is invoked", () => {
    const { proposal, quote } = failFixture;
    const expected = failFixture.commitResponse.admissionRefusal;
    const decision = evaluateAdmissionOnly(proposal, quote, () => ({
      coverage: expected.coverage, failures: expected.failures, stateRef: expected.stateRef,
    }), new Date(expected.evaluatedAt));
    expect(decision).toEqual({ kind: "ADMISSION_REFUSED", admissionRefusal: expected });
  });

  it("fails closed if a declared relation has no evaluator", () => {
    expect(() => evaluateAdmissionOnly(passProposal, passFixture.quote)).toThrow(/require a live evaluator/);
  });

  it("refuses a fake PASSED relation missing mandatory satisfaction evidence", () => {
    const expected = passFixture.commitResponse.admissionReport;
    expect(() => evaluateAdmissionOnly(passProposal, passFixture.quote, () => ({
      coverage: expected.coverage.map(c => ({ relationId: c.relationId, status: "PASSED" as const })),
      failures: [],
    }), new Date(expected.evaluatedAt))).toThrow();
  });

  it("refuses fabricated partial coverage instead of silently treating unvisited relations as passed", () => {
    const expected = passFixture.commitResponse.admissionReport;
    expect(() => evaluateAdmissionOnly(passProposal, passFixture.quote, () => ({
      coverage: [],
      failures: [],
    }), new Date(expected.evaluatedAt))).toThrow(/omits/);
  });

  it("does not present any commit result, unit outcome or finality proof", () => {
    const decision = evaluateAdmissionOnly(passProposal, passFixture.quote, () => ({
      coverage: passFixture.commitResponse.admissionReport.coverage,
      failures: [],
    }));
    expect(decision.kind).toBe("ADMISSION_PASSED");
    expect("commitResult" in decision).toBe(false);
    expect("effectReceipts" in decision).toBe(false);
  });
});
