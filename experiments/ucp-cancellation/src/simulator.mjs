import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { admissionGate } from './admission.mjs';
import { CAPABILITY, VERSION, PARENT, READ, MANAGE } from './fixtures.mjs';

const copy = x => structuredClone(x);
const hash = x => createHash('sha256').update(x).digest('hex');
const terminal = new Set(['committed', 'refused', 'failed', 'not_attempted']);
const keyScope = (ctx, order, op, key) => JSON.stringify([ctx.platform, order, op, key]);
const token = () => randomUUID();
const money = x => Number.isSafeInteger(x) && x >= 0;

export class ContractError extends Error {
  constructor(code, status = 409) { super(code); this.code = code; this.status = status; }
}
export class LostResponse extends Error {}
export class SimulatedCrash extends Error {}
const fail = (code, status) => { throw new ContractError(code, status); };

// This store is a single-writer process-restart simulator, not a production database.
// Every simulated effect and attempt is persisted in one JSON snapshot. It does not
// claim distributed locking, crash/power-loss durability, or real-provider atomicity.
export class CancellationSimulator {
  constructor({ file, config, now = Date.parse('2026-11-06T18:00:00Z') }) {
    this.file = file; this.now = now; this.storageDown = false;
    this.hiddenEvidence = new Set(); this.faults = {};
    if (existsSync(file)) this.state = JSON.parse(readFileSync(file, 'utf8'));
    else {
      const c = copy(config);
      c.order.order_version = token();
      for (const u of c.units) if (!money(u.amount) || (u.estimate !== undefined && !money(u.estimate))) fail('invalid_fixture');
      this.state = { config: c, attempts: {}, claims: {}, fences: {}, fenceReplays: {}, provider: {}, dispatches: 0 };
      this.save();
    }
  }
  save() {
    if (this.storageDown) fail('storage_unavailable', 503);
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.state, null, 2), { mode: 0o600 });
    renameSync(tmp, this.file);
  }
  tx(fn) {
    if (this.storageDown) fail('storage_unavailable', 503);
    const before = copy(this.state);
    try { const result = fn(); this.save(); return result; }
    catch (error) { this.state = before; throw error; }
  }
  advance(ms) { this.now += ms; }
  auth(ctx, scope) {
    if (!ctx?.platform || ctx.buyer !== this.state.config.owner || !ctx.scopes?.includes(scope)) fail('unauthorized', 403);
  }
  businessAuth(ctx) { if (ctx?.business !== this.state.config.business) fail('unauthorized', 403); }
  negotiated(caps) {
    if (!this.state.config.supported || !caps?.some(x => x.name === CAPABILITY && x.version === VERSION) ||
        !caps.some(x => x.name === PARENT.name && x.version === PARENT.version)) fail('modification_not_supported', 400);
  }
  profile() { return [copy(PARENT), ...(this.state.config.supported ? [{ name: CAPABILITY, version: VERSION, extends: [PARENT.name] }] : [])]; }
  order(ctx, caps = []) {
    this.auth(ctx, READ);
    if (this.storageDown) fail('storage_unavailable', 503);
    const c = this.state.config, order = copy(c.order);
    if (c.supported && caps.some(x => x.name === CAPABILITY && x.version === VERSION) &&
        caps.some(x => x.name === PARENT.name && x.version === PARENT.version)) {
      order.modification = {
        granularity: c.granularity, atomicity: c.atomicity,
        operations: c.wholeAvailable ? ['cancel'] : [],
        order_cancellation: {
          available: c.wholeAvailable, ...(c.wholeAvailable ? { processing_mode: c.wholeMode } : { reason_code: 'whole_order_unavailable' }),
          reversible_amount: c.wholeAmount,
          ...(c.wholeEstimate === undefined ? {} : { estimated_refund_amount: c.wholeEstimate })
        },
        ...(c.granularity === 'by_unit' ? { units: c.units.map(u => ({
          id: u.id, operations: u.supported && !u.canceled ? ['cancel'] : [],
          processing_mode: u.mode, reversible_amount: u.amount,
          // fulfillment_expectation is an experimental target vocabulary value,
          // referencing an actual expectation, never a fabricated goods line.
          targets: u.line ? [{ type: 'line_item', id: u.line, quantity: u.quantity }] :
            [{ type: 'fulfillment_expectation', id: u.expectation }],
          ...(u.estimate === undefined ? {} : { estimated_refund_amount: u.estimate }),
          ...(!u.supported ? { reason_code: 'structurally_unavailable', reason: 'No independent cancellation is declared.' } :
            !u.policy ? { reason_code: 'refused_by_policy', reason: 'Business policy presently refuses cancellation.' } : {})
        })) } : {})
      };
    } else delete order.order_version;
    return order;
  }
  bump() { this.state.config.order.order_version = token(); }
  patchUnit(ctx, id, patch) {
    this.businessAuth(ctx);
    this.tx(() => { Object.assign(this.unit(id), copy(patch)); this.bump(); });
  }
  unit(id) { const u = this.state.config.units.find(x => x.id === id); if (!u) fail('unknown_modification_unit', 400); return u; }
  parse(raw) {
    try { return JSON.parse(raw); } catch { fail('invalid_modification_request', 400); }
  }
  validate(req) {
    if (!req || Object.keys(req).some(k => !['base_order_version', 'operations'].includes(k)) ||
        !Array.isArray(req.operations) || !req.operations.length) fail('invalid_modification_request', 400);
    const names = new Set();
    for (const op of req.operations) {
      const t = op?.target;
      if (!t || Object.keys(op).some(k => !['op', 'target'].includes(k)) ||
          Object.keys(t).some(k => !['type', 'id'].includes(k)) ||
          !['order', 'unit'].includes(t.type) ||
          (t.type === 'order' ? t.id !== undefined : typeof t.id !== 'string' || !t.id)) fail('invalid_modification_request', 400);
      const id = t.type === 'order' ? '$order' : t.id;
      if (names.has(id)) fail('invalid_modification_request', 400);
      names.add(id);
    }
    if (names.has('$order') && names.size !== 1) fail('invalid_modification_request', 400);
    const c = this.state.config;
    if (!['atomic', 'per_unit'].includes(c.atomicity)) fail('unsupported_atomicity', 400);
    for (const op of req.operations) {
      const t = op.target;
      if (t.type === 'unit') {
        if (c.granularity !== 'by_unit') fail('unknown_modification_unit', 400);
        const u = this.unit(t.id);
        if (!u.supported || op.op !== 'cancel') fail('operation_not_supported_for_unit', 400);
      } else if (!c.wholeAvailable || op.op !== 'cancel') fail('operation_not_supported_for_unit', 400);
    }
  }
  selected(operations) {
    return operations[0].target.type === 'order' ? this.state.config.units : operations.map(o => this.unit(o.target.id));
  }
  publicRecord(a) {
    return {
      modification_id: a.id, order_id: this.state.config.order.id,
      base_order_version: a.request.base_order_version, atomicity: a.atomicity,
      status: a.results.every(r => terminal.has(r.outcome)) ? 'closed' : 'open',
      results: copy(a.results), created_at: a.created, updated_at: a.updated,
      retained_until: new Date(a.retainedUntil).toISOString()
    };
  }
  submit(ctx, caps, key, raw, { loseResponse = false, crash = undefined } = {}) {
    this.auth(ctx, MANAGE); this.negotiated(caps);
    if (this.storageDown) fail('storage_unavailable', 503);
    // Entropy itself cannot be measured from one key. This demo accepts UUID shape;
    // its client always generates randomUUID(), rather than claiming a shape proves entropy.
    if (!/^[0-9a-f-]{36}$/i.test(key) || typeof raw !== 'string') fail('invalid_modification_request', 400);
    const scope = keyScope(ctx, this.state.config.order.id, 'cancel', key), digest = hash(raw);
    if (this.state.fences[scope]) fail('key_fenced', 409);
    const claim = this.state.claims[scope];
    if (claim) {
      if (claim.digest !== digest) fail('idempotency_conflict', 409);
      const a = this.state.attempts[claim.id];
      if (!a || this.now >= a.replayUntil || !a.initial) fail('attempt_unresolved', 409);
      return copy(a.initial); // Deliberately historical; use lookup for current truth.
    }
    const req = this.parse(raw);
    if (req?.base_order_version !== this.state.config.order.order_version) fail('stale_order_state', 409);
    this.validate(req); // Version precedes target addressing and support checks.
    const id = token();
    this.tx(() => {
      const created = new Date(this.now).toISOString();
      this.state.claims[scope] = { id, digest };
      this.state.attempts[id] = {
        id, scope, platform: ctx.platform, buyer: ctx.buyer, request: req,
        atomicity: this.state.config.atomicity, created, updated: created,
        replayUntil: this.now + 48 * 3600000, retainedUntil: this.now + 30 * 86400000,
        reviewExpires: this.now + 3600000, initial: null,
        results: req.operations.map(o => ({ ...copy(o), outcome: 'indeterminate' }))
      };
    }); // Claim and attempt precede every dispatch, including crash injection.
    if (crash === 'after_claim') throw new SimulatedCrash('claimed; no automatic recovery dispatch');
    const a = this.state.attempts[id];
    const gate = admissionGate(this.state.config, this.selected(req.operations), id, this.now);
    this.tx(() => {
      a.admission = gate;
      if (gate.kind === 'ADMISSION_REFUSED') {
        a.results.forEach(r => { r.outcome = 'refused'; r.reason_code = 'dependency_unsatisfied'; });
      }
    });
    if (gate.kind === 'ADMISSION_PASSED') this.process(id, { crash });
    this.tx(() => { const attempt = this.state.attempts[id]; attempt.initial = this.publicRecord(attempt); });
    const result = copy(this.state.attempts[id].initial);
    if (loseResponse) throw new LostResponse('response dropped after persistence');
    return result;
  }
  targetUnits(r) { return r.target.type === 'order' ? this.state.config.units : [this.unit(r.target.id)]; }
  eligibility(r, id) {
    const units = this.targetUnits(r);
    if (units.some(u => u.canceled)) return 'unit_unavailable';
    // An unresolved dispatch reserves its effects. A known pending review is not
    // an execution lock; competitors may be admitted and serialized at commitment.
    for (const a of Object.values(this.state.attempts)) if (a.id !== id) {
      if (a.results.some(x => x.outcome === 'indeterminate' && this.targetUnits(x).some(u => units.some(v => v.id === u.id)))) return 'conflicting_modification';
    }
    if (units.some(u => u.line && this.state.config.order.line_items.find(l => l.id === u.line).quantity.fulfilled > 0)) return 'stale_eligibility';
    if (units.some(u => !u.policy)) return 'refused_by_policy';
    if (r.target.type === 'unit' && !units[0].supported) return 'stale_eligibility';
    if (r.target.type === 'order' && !this.state.config.wholeAvailable) return 'stale_eligibility';
    return undefined;
  }
  process(id, { approved = false, crash } = {}) {
    const a = this.state.attempts[id], c = this.state.config;
    const active = a.results.map((r, i) => ({ r, i })).filter(({ r, i }) =>
      !terminal.has(r.outcome) && !a.dispatchedIndices?.includes(i));
    const checks = active.map(({ r, i }) => ({ r, i, reason: this.eligibility(r, id),
      review: r.target.type === 'order' ? c.wholeMode !== 'immediate' : this.unit(r.target.id).mode !== 'immediate' }));
    if (a.atomicity === 'atomic') {
      const bad = checks.find(x => x.reason);
      if (bad) {
        this.tx(() => checks.forEach(x => Object.assign(x.r, x === bad ?
          { outcome: 'refused', reason_code: bad.reason } :
          { outcome: 'not_attempted', blocked_by: { type: 'condition', reason_code: 'atomic_group_not_committable' } })));
        return;
      }
      if (!approved && checks.some(x => x.review)) {
        this.tx(() => checks.forEach(x => { x.r.outcome = 'awaiting_business_decision'; })); return;
      }
      this.dispatch(id, checks.map(x => x.i), crash);
    } else for (const x of checks) {
      if (x.reason) this.tx(() => Object.assign(x.r, { outcome: 'refused', reason_code: x.reason }));
      else if (!approved && x.review) this.tx(() => { x.r.outcome = 'awaiting_business_decision'; });
      else this.dispatch(id, [x.i], crash);
    }
    this.tx(() => { a.updated = new Date(this.now).toISOString(); });
  }
  dispatch(id, indices, crash) {
    const a = this.state.attempts[id];
    const pkey = `${id}:${indices.join(',')}`;
    const modes = indices.map(i => this.faults[a.results[i].target.id ?? '$order'] ?? 'commit');
    // Journal dispatch intent first. A restart leaves uncertainty; no replay invokes dispatch.
    this.tx(() => {
      indices.forEach(i => { a.results[i].outcome = 'indeterminate'; });
      a.dispatchedIndices = [...(a.dispatchedIndices ?? []), ...indices];
      this.state.dispatches++;
    });
    if (crash === 'before_effect') throw new SimulatedCrash('dispatch intent persisted; execution unproven');
    const unknown = modes.includes('unknown'), failure = modes.includes('fail');
    this.tx(() => {
      if (unknown) return; // No authoritative proof; absence cannot establish failure.
      if (failure) this.state.provider[pkey] = { committed: false, indices };
      else {
        const committed = indices.map(i => this.applyEffect(a.results[i], id, i));
        this.state.provider[pkey] = { committed: true, indices, committed };
        this.bump();
      }
    });
    if (modes.includes('hidden_commit')) this.hiddenEvidence.add(pkey);
    if (crash === 'after_effect') throw new SimulatedCrash('effect persisted; attempt still indeterminate');
    if (!this.hiddenEvidence.has(pkey)) this.resolveProvider(id, pkey);
  }
  applyEffect(r, id, i) {
    const units = this.targetUnits(r);
    for (const u of units) {
      u.canceled = true;
      if (u.line) {
        const line = this.state.config.order.line_items.find(l => l.id === u.line);
        line.quantity.total -= u.quantity;
        line.status = line.quantity.total === 0 ? 'removed' : line.quantity.fulfilled === line.quantity.total ? 'fulfilled' : 'processing';
      }
    }
    const adjustment = `adjustment:${id}:${i}`, c = this.state.config;
    // Fixture allocation may differ from attributed affected amount. This is an
    // estimate only; no signed actual is manufactured when money is still unknown.
    const estimate = r.target.type === 'order' ? c.wholeEstimate : units[0].estimate;
    c.order.adjustments.push({ id: adjustment, type: 'refund', status: 'pending', occurred_at: new Date(this.now).toISOString(),
      ...(units.some(u => u.line) ? { line_items: units.filter(u => u.line).map(u => ({ id: u.line, quantity: -u.quantity })) } : {}) });
    return { affected_amount: r.target.type === 'order' ? c.wholeAmount : units[0].amount, adjustments: [adjustment],
      estimate, currency: c.order.currency };
  }
  resolveProvider(id, pkey) {
    const proof = this.state.provider[pkey];
    if (!proof || this.hiddenEvidence.has(pkey)) return;
    this.tx(() => {
      const a = this.state.attempts[id];
      proof.indices.forEach((i, n) => {
        if (a.results[i].outcome !== 'indeterminate') return;
        Object.assign(a.results[i], proof.committed ? { outcome: 'committed',
          affected_amount: proof.committed[n].affected_amount, adjustments: proof.committed[n].adjustments } :
          { outcome: 'failed', reason_code: 'confirmed_non_execution' });
      });
      a.updated = new Date(this.now).toISOString();
    });
  }
  // Internal simulated Business worker, never a proposed public mutation operation.
  decide(ctx, id, approve) {
    this.businessAuth(ctx);
    const a = this.state.attempts[id]; if (!a) fail('unknown_attempt', 404);
    if (!a.results.some(r => r.outcome === 'awaiting_business_decision')) fail('decision_not_pending');
    if (!approve || this.now >= a.reviewExpires) this.tx(() => {
      a.results.filter(r => r.outcome === 'awaiting_business_decision').forEach(r => Object.assign(r,
        { outcome: 'refused', reason_code: approve ? 'approval_expired' : 'refused_by_policy' }));
      a.updated = new Date(this.now).toISOString();
    });
    else this.process(id, { approved: true });
    return this.publicRecord(a);
  }
  reconcile(ctx, id) {
    this.businessAuth(ctx);
    for (const pkey of Object.keys(this.state.provider).filter(k => k.startsWith(`${id}:`))) this.resolveProvider(id, pkey);
  }
  lookup(ctx, caps, key) {
    this.auth(ctx, READ); this.negotiated(caps);
    if (this.storageDown) fail('storage_unavailable', 503);
    const scope = keyScope(ctx, this.state.config.order.id, 'cancel', key), claim = this.state.claims[scope];
    if (this.state.fences[scope]) return { status: 'not_found', key_fenced: true };
    if (!claim) return { status: 'unresolved', reason_code: 'admission_in_flight' };
    const a = this.state.attempts[claim.id];
    if (!a || this.now >= a.retainedUntil) return { status: 'unresolved', reason_code: 'record_expired' };
    return { status: 'found', modification: this.publicRecord(a) };
  }
  get(ctx, caps, id) {
    this.auth(ctx, READ); this.negotiated(caps);
    if (this.storageDown) fail('storage_unavailable', 503);
    const a = this.state.attempts[id];
    if (!a || a.platform !== ctx.platform || a.buyer !== ctx.buyer) fail('unknown_attempt', 404);
    if (this.now >= a.retainedUntil) fail('record_expired', 410);
    return this.publicRecord(a);
  }
  fence(ctx, caps, fenceKey, originalKey) {
    this.auth(ctx, MANAGE); this.negotiated(caps);
    if (fenceKey === originalKey) fail('invalid_modification_request', 400);
    if (this.storageDown) fail('storage_unavailable', 503);
    const replayScope = keyScope(ctx, this.state.config.order.id, 'fence', fenceKey);
    const digest = hash(JSON.stringify({ operation: 'cancel', original_key: originalKey }));
    const priorReplay = this.state.fenceReplays[replayScope];
    if (priorReplay) {
      if (priorReplay.digest !== digest) fail('idempotency_conflict');
      return copy(priorReplay.response);
    }
    const scope = keyScope(ctx, this.state.config.order.id, 'cancel', originalKey);
    const prior = this.lookup(ctx, caps, originalKey);
    const response = prior.status === 'found' || prior.reason_code === 'record_expired' ? prior : { status: 'fenced', key_fenced: true };
    this.tx(() => {
      if (response.status === 'fenced') this.state.fences[scope] = true;
      this.state.fenceReplays[replayScope] = { digest, response };
    });
    return copy(response);
  }
  settle(ctx, adjustmentId, observation) {
    this.businessAuth(ctx);
    const a = this.state.config.order.adjustments.find(a => a.id === adjustmentId);
    if (!a) fail('unknown_adjustment', 404);
    if (a.status === 'completed') fail('adjustment_final');
    if (!['pending', 'unknown', 'completed', 'failed'].includes(observation.status)) fail('invalid_observation');
    if (observation.status === 'completed') {
      if (observation.currency !== this.state.config.order.currency ||
          !Array.isArray(observation.components) || !observation.components.length ||
          observation.components.some(c => !['original_payment', 'loyalty', 'store_credit'].includes(c.method) || !money(c.amount))) fail('invalid_observation');
      const total = observation.components.reduce((sum, c) => sum + BigInt(c.amount), 0n);
      if (total > BigInt(Number.MAX_SAFE_INTEGER)) fail('invalid_observation');
    }
    this.tx(() => {
      // Current UCP adjustment.status is a closed enum. Uncertain settlement is
      // retained as pending on Order; uncertainty lives in binding-local evidence.
      a.status = observation.status === 'unknown' ? 'pending' : observation.status;
      this.state.provider[`financial:${adjustmentId}`] = copy(observation);
      if (a.status === 'completed') {
        const amount = observation.components.reduce((sum, c) => sum + c.amount, 0);
        a.totals = [{ type: 'total', amount: -amount }];
        // Binding-local observation evidence, not new standard adjustment fields.
      }
      this.bump();
    });
  }
  refundView(ctx, adjustmentId) {
    this.auth(ctx, READ);
    const a = this.state.config.order.adjustments.find(x => x.id === adjustmentId);
    const p = this.state.provider[`financial:${adjustmentId}`];
    if (!a) fail('unknown_adjustment', 404);
    if (a.status !== 'completed' || !p) return { determinacy: 'UNKNOWN', status: p?.status ?? a.status };
    return { determinacy: 'DETERMINED', status: a.status, amount: -a.totals[0].amount,
      currency: p.currency, components: copy(p.components) };
  }
}

export class CancellationClient {
  constructor(server, ctx, supported = [PARENT, { name: CAPABILITY, version: VERSION }]) {
    this.server = server; this.ctx = ctx;
    this.caps = server.profile().filter(s => supported.some(p => p.name === s.name && p.version === s.version));
    this.inflight = new Map();
  }
  read() { return this.server.order(this.ctx, this.caps); }
  cancel(raw, options) {
    const req = JSON.parse(raw), units = req.operations.map(o => o.target.type === 'order' ? '$order' : o.target.id);
    if ([...this.inflight.values()].some(a => a.units.some(u => units.includes(u) || u === '$order' || units.includes('$order')))) fail('client_attempt_unresolved');
    const key = token(); this.inflight.set(key, { raw, units });
    try { const result = this.server.submit(this.ctx, this.caps, key, raw, options);
      if (result.status === 'closed') this.inflight.delete(key);
      return { key, result };
    } catch (error) { error.attemptKey = key; throw error; }
  }
  recover(key) {
    const result = this.server.lookup(this.ctx, this.caps, key);
    if (result.status === 'found' && result.modification.status === 'closed') this.inflight.delete(key);
    // No POST/replay/new key occurs here, even on an unresolved lookup.
    return { lookup: result, order: this.read() };
  }
}
