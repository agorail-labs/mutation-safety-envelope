import { evaluateAdmissionOnly } from '@agorail-labs/mse-reference';

// Binding-local dependency interpretation. No MSE wire payload is required by UCP.
export function admissionGate(config, selected, attemptId, now) {
  const transition = u => ({ kind: 'CANCEL_UNIT', orderId: config.order.id, unitId: u.id });
  const relations = selected.flatMap(u => u.requires.map(required => ({
    relationId: `requires:${u.id}:${required}`, type: 'REQUIRES_COINCLUSION',
    triggerUnitRefs: [u.id], scopeRef: config.order.id
  })));
  const proposal = { proposalId: attemptId, target: { orderId: config.order.id }, change: { operation: 'cancel' } };
  const quote = {
    quoteId: `admission:${attemptId}`, target: proposal.target,
    units: selected.map(u => ({ unitRef: u.id,
      unitLocator: { scopeRef: config.order.id, unitKey: u.id }, transition: transition(u), effects: [] })),
    admissionRelations: relations
  };
  return evaluateAdmissionOnly(proposal, quote, () => {
    const coverage = [], failures = [];
    for (const u of selected) for (const required of u.requires) {
      const relationId = `requires:${u.id}:${required}`;
      const other = selected.find(v => v.id === required);
      if (other) coverage.push({ relationId, status: 'PASSED', satisfactions: [
        { source: 'CURRENT_REQUEST', unitRef: other.id, transition: transition(other) }
      ] });
      else {
        coverage.push({ relationId, status: 'FAILED' });
        failures.push({ relationId, witness: { disposition: 'COMPLETE', requiredTransitions: [{
          unitLocator: { scopeRef: config.order.id, unitKey: required },
          transition: { kind: 'CANCEL_UNIT', orderId: config.order.id, unitId: required }
        }] } });
      }
    }
    return { coverage, failures, stateRef: config.order.order_version };
  }, new Date(now));
}
