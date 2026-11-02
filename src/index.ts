/**
 * Experimental MSE runtime exports.
 * This package contains the domain-blind admission validator and reference
 * simulator; it does NOT provide authorization, durable execution, billing
 * provider integration or exactly-once semantics.
 */
export { evaluateAdmissionOnly, type AdmissionOnlyDecision } from "./core/admission-only";
export { ReferenceProvider, type AdmissionEvaluator, type AdmissionEvaluation, type Quoter } from "./core/reference-provider";
export {
  assertAdmissionReportWellFormed,
  assertAdmissionRefusalWellFormed,
  assertQuoteUnitsWellFormed,
  assertCommitResponseWellFormed,
  deriveSatisfactionRealization,
  MseViolation,
} from "./core/validate";
export type * from "./core/types";
