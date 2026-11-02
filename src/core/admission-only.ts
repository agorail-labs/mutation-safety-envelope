/**
 * MSE v0.4 development integration entrypoint.
 *
 * Evaluates the binding's live admission dependencies and produces the
 * fully quote-correlated report WITHOUT calling ReferenceProvider.commit().
 * The caller may use this as a read-only gate before an independently
 * durable executor (e.g. SCQ). MSE admission is never an authorization,
 * check-to-dispatch lock, atomic provider write, or execution receipt.
 */
import type {
  MutationProposal, MutationQuote, AdmissionReport, AdmissionRefusal,
  SuccessfulAdmissionReport, AdmissionFailure,
} from "./types";
import type { AdmissionEvaluator } from "./reference-provider";
import {
  assertQuoteUnitsWellFormed,
  assertAdmissionReportWellFormed,
  assertAdmissionRefusalWellFormed,
  MseViolation,
} from "./validate";

export type AdmissionOnlyDecision =
  | { kind: "ADMISSION_REFUSED"; admissionRefusal: AdmissionRefusal }
  | { kind: "ADMISSION_PASSED"; admissionReport: SuccessfulAdmissionReport };

export function evaluateAdmissionOnly(
  proposal: MutationProposal,
  quote: MutationQuote,
  evaluator?: AdmissionEvaluator,
  now: Date = new Date(),
): AdmissionOnlyDecision {
  assertQuoteUnitsWellFormed(quote);
  if (!proposal || typeof proposal.proposalId !== "string" || !proposal.proposalId) {
    throw new MseViolation("Admission requires the originating proposal identity");
  }
  if (!Number.isFinite(now.getTime())) {
    throw new MseViolation("Admission evaluation time must be valid");
  }
  if (quote.admissionRelations.length && !evaluator) {
    throw new MseViolation("Declared admission relations require a live evaluator; no dispatch is allowed");
  }
  // No state claim is produced when there are no declared relations.
  const evidence = quote.admissionRelations.length
    ? evaluator!(proposal, quote, now)
    : { coverage: [], failures: [] as AdmissionFailure[] };
  if (!evidence || !Array.isArray(evidence.coverage) || !Array.isArray(evidence.failures)) {
    throw new MseViolation("The admission evaluator returned malformed evidence");
  }
  const report: AdmissionReport = {
    quoteId: quote.quoteId,
    proposalId: proposal.proposalId,
    evaluatedAt: now.toISOString(),
    ...(evidence.stateRef === undefined ? {} : { stateRef: evidence.stateRef }),
    coverage: evidence.coverage,
    failures: evidence.failures,
  };
  assertAdmissionReportWellFormed(quote, proposal, report);
  if (report.failures.length) {
    const refusal: AdmissionRefusal = {
      ...report,
      failures: report.failures as [AdmissionFailure, ...AdmissionFailure[]],
    };
    assertAdmissionRefusalWellFormed(quote, proposal, refusal);
    return { kind: "ADMISSION_REFUSED", admissionRefusal: refusal };
  }
  return {
    kind: "ADMISSION_PASSED",
    admissionReport: { ...report, failures: [] },
  };
}
