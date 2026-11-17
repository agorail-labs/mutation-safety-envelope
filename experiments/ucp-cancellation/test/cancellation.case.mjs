import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CancellationSimulator, CancellationClient, LostResponse, SimulatedCrash } from '../src/simulator.mjs';
import { fixture, buyer, business, request, READ, MANAGE, CAPABILITY, VERSION } from '../src/fixtures.mjs';

const harness = (t, options = {}, mutate = () => {}) => {
  const dir = mkdtempSync(join(tmpdir(), 'ucp-cancel-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const config = fixture(options); mutate(config);
  const file = join(dir, 'journal.json'), server = new CancellationSimulator({ file, config });
  const ctx = buyer(), caps = server.profile();
  const raw = ids => request(server.order(ctx, caps).order_version, ids);
  const send = (ids, options) => { const key = randomUUID(), body = raw(ids);
    return { key, body, result: server.submit(ctx, caps, key, body, options) }; };
  return { server, ctx, caps, raw, send, file };
};
const code = name => e => e.code === name;
const outcomes = r => r.results.map(r => r.outcome);

test('N01 unsupported capability has no declarations and mutation fails closed', t => {
  const h = harness(t, {}, c => { c.supported = false; });
  assert.equal(h.server.order(h.ctx).modification, undefined);
  assert.throws(() => h.send(['goods-a']), code('modification_not_supported'));
  assert.equal(h.server.state.dispatches, 0);
});
test('N02 base Order and manage scope alone do not negotiate cancellation', t => {
  const h = harness(t);
  assert.equal(h.server.order(h.ctx).modification, undefined);
  assert.throws(() => h.server.submit(h.ctx, [], randomUUID(), h.raw()), code('modification_not_supported'));
  assert.throws(() => h.server.submit(h.ctx, [{ name: CAPABILITY, version: 'unknown' }], randomUUID(), h.raw()), code('modification_not_supported'));
});
test('N03 stale version wins over unknown target; no attempt or effect', t => {
  const h = harness(t), raw = h.raw(['does-not-exist']);
  h.server.patchUnit(business(), 'goods-a', { policy: false });
  assert.throws(() => h.server.submit(h.ctx, h.caps, randomUUID(), raw), code('stale_order_state'));
  assert.equal(Object.keys(h.server.state.claims).length, 0);
  assert.equal(h.server.state.dispatches, 0);
});
test('N04 unknown target differs from structural unavailability and policy refusal', t => {
  const h = harness(t);
  assert.throws(() => h.send(['typo']), code('unknown_modification_unit'));
  assert.throws(() => h.send(['delivery']), code('operation_not_supported_for_unit'));
  h.server.patchUnit(business(), 'goods-a', { policy: false });
  const r = h.send(['goods-a']).result;
  assert.equal(r.results[0].reason_code, 'refused_by_policy');
  assert.equal(h.server.state.dispatches, 0);
});
test('N05 pooled declaration is explicit order-only; no inference from lines', t => {
  const h = harness(t, { granularity: 'order_only', atomicity: 'atomic' });
  const o = h.server.order(h.ctx, h.caps);
  assert.equal(o.modification.granularity, 'order_only');
  assert.equal(o.modification.units, undefined);
  assert.throws(() => h.send(['goods-a']), code('unknown_modification_unit'));
  assert.deepEqual(outcomes(h.send(['$order']).result), ['committed']);
});
test('P01 cancel one unit preserves sibling and retained delivery, amount is unit amount', t => {
  const h = harness(t), r = h.send(['goods-a']).result;
  assert.equal(r.results[0].affected_amount, 3000);
  const o = h.server.order(h.ctx, h.caps);
  assert.equal(o.line_items[0].quantity.total, 0); assert.equal(o.line_items[0].quantity.original, 2);
  assert.equal(o.line_items[0].status, 'removed'); assert.equal(o.line_items[1].quantity.total, 1);
  assert.equal(h.server.unit('delivery').canceled, undefined);
  assert.equal(o.adjustments[0].status, 'pending'); assert.equal(o.adjustments[0].totals, undefined);
});
test('P02 whole-order is one atomic target, includes retained delivery without inventing a line', t => {
  const h = harness(t), r = h.send(['$order']).result;
  assert.equal(r.results.length, 1); assert.equal(r.results[0].affected_amount, 5500);
  assert.ok(h.server.state.config.units.every(u => u.canceled));
  assert.equal(h.server.order(h.ctx, h.caps).line_items.length, 2);
});
test('N06 duplicate attempt replays initial bytes-equivalent response without dispatch', t => {
  const h = harness(t), a = h.send(['goods-a']);
  const r = h.server.submit(h.ctx, h.caps, a.key, a.body);
  assert.deepEqual(r, a.result); assert.equal(h.server.state.dispatches, 1);
});
test('N07 raw JSON reordering under same key conflicts even when parsed JSON is equal', t => {
  const h = harness(t), a = h.send(['goods-a']), req = JSON.parse(a.body);
  const changed = JSON.stringify({ operations: req.operations, base_order_version: req.base_order_version });
  assert.deepEqual(JSON.parse(changed), req);
  assert.throws(() => h.server.submit(h.ctx, h.caps, a.key, changed), code('idempotency_conflict'));
  assert.equal(h.server.state.dispatches, 1);
});
test('N08 two concurrent same-version requests serialize; exactly one dispatch', async t => {
  const h = harness(t), raw = h.raw(['goods-a']);
  const results = await Promise.allSettled([1, 2].map(() => Promise.resolve().then(() => h.server.submit(h.ctx, h.caps, randomUUID(), raw))));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.code, 'stale_order_state');
  assert.equal(h.server.state.dispatches, 1);
});
test('N09 per-unit partial commitment evaluates an independent policy refusal', t => {
  const h = harness(t, {}, c => { c.units[1].policy = false; });
  const r = h.send(['goods-a', 'goods-b']).result;
  assert.deepEqual(outcomes(r), ['committed', 'refused']); assert.equal(r.status, 'closed');
  assert.equal(h.server.order(h.ctx, h.caps).line_items[1].quantity.total, 1);
});
test('N10 atomic refusal blocks sibling, with dependency, and commits nothing', t => {
  const h = harness(t, { atomicity: 'atomic' }, c => { c.units[1].policy = false; });
  const r = h.send(['goods-a', 'goods-b']).result;
  assert.deepEqual(outcomes(r), ['not_attempted', 'refused']);
  assert.equal(r.results[0].blocked_by.reason_code, 'atomic_group_not_committable');
  assert.equal(h.server.state.dispatches, 0);
});
test('N11 pending merchant decision differs from indeterminate and refund-pending', t => {
  const h = harness(t, { review: true }), a = h.send(['goods-b']);
  assert.deepEqual(outcomes(a.result), ['awaiting_business_decision']);
  assert.equal(a.result.status, 'open'); assert.equal(h.server.state.dispatches, 0);
  assert.equal(h.server.order(h.ctx, h.caps).adjustments.length, 0);
  h.server.decide(business(), a.result.modification_id, true);
  const current = h.server.lookup(h.ctx, h.caps, a.key).modification;
  assert.deepEqual(outcomes(current), ['committed']);
  assert.deepEqual(outcomes(h.server.submit(h.ctx, h.caps, a.key, a.body)), ['awaiting_business_decision']);
});
test('N12 atomic review holds immediate sibling until all approval is decided', t => {
  const h = harness(t, { review: true, atomicity: 'atomic' }), a = h.send(['goods-a', 'goods-b']);
  assert.deepEqual(outcomes(a.result), ['awaiting_business_decision', 'awaiting_business_decision']);
  assert.equal(h.server.state.dispatches, 0);
  assert.deepEqual(outcomes(h.server.decide(business(), a.result.modification_id, true)), ['committed', 'committed']);
  assert.equal(h.server.state.dispatches, 1);
});
test('N13 expired approval cannot dispatch or mutate', t => {
  const h = harness(t, { review: true }), a = h.send(['goods-b']); h.server.advance(3600000);
  const r = h.server.decide(business(), a.result.modification_id, true);
  assert.equal(r.results[0].reason_code, 'approval_expired'); assert.equal(h.server.state.dispatches, 0);
});
test('N14 merchant refusal is terminal; late approval cannot revive it', t => {
  const h = harness(t, { review: true }), a = h.send(['goods-b']);
  assert.deepEqual(outcomes(h.server.decide(business(), a.result.modification_id, false)), ['refused']);
  assert.throws(() => h.server.decide(business(), a.result.modification_id, true), code('decision_not_pending'));
});
test('N15 fulfillment during review revalidates eligibility; no blind approval commit', t => {
  const h = harness(t, { review: true }), a = h.send(['goods-b']);
  h.server.tx(() => { h.server.state.config.order.line_items[1].quantity.fulfilled = 1; h.server.bump(); });
  const r = h.server.decide(business(), a.result.modification_id, true);
  assert.equal(r.results[0].reason_code, 'stale_eligibility'); assert.equal(h.server.state.dispatches, 0);
});
test('N16 overlapping pending attempts may be admitted; at most one commits', t => {
  const h = harness(t, { review: true }), a = h.send(['goods-b']), b = h.send(['goods-b']);
  h.server.decide(business(), a.result.modification_id, true);
  const second = h.server.decide(business(), b.result.modification_id, true);
  assert.equal(second.results[0].reason_code, 'unit_unavailable'); assert.equal(h.server.state.dispatches, 1);
});
test('N17 lost response resolves by scoped lookup and current Order; no redispatch', t => {
  const h = harness(t), client = new CancellationClient(h.server, h.ctx); let e;
  try { client.cancel(h.raw(['goods-a']), { loseResponse: true }); } catch (err) { e = err; }
  assert.ok(e instanceof LostResponse);
  const r = client.recover(e.attemptKey);
  assert.equal(r.lookup.status, 'found'); assert.equal(r.order.line_items[0].quantity.total, 0);
  assert.equal(h.server.state.dispatches, 1);
});
test('N18 unknown lookup is read-only and never proves no execution', t => {
  const h = harness(t), bytes = readFileSync(h.file, 'utf8'), key = randomUUID();
  assert.equal(h.server.lookup(h.ctx, h.caps, key).status, 'unresolved');
  assert.equal(h.server.lookup(h.ctx, h.caps, key).status, 'unresolved');
  assert.equal(readFileSync(h.file, 'utf8'), bytes);
});
test('N19 crash after effect survives process restart and reconciles once', t => {
  const h = harness(t), key = randomUUID(), raw = h.raw(['goods-a']);
  assert.throws(() => h.server.submit(h.ctx, h.caps, key, raw, { crash: 'after_effect' }), SimulatedCrash);
  const restarted = new CancellationSimulator({ file: h.file });
  const found = restarted.lookup(h.ctx, h.caps, key).modification;
  assert.deepEqual(outcomes(found), ['indeterminate']);
  restarted.reconcile(business(), found.modification_id);
  assert.deepEqual(outcomes(restarted.get(h.ctx, h.caps, found.modification_id)), ['committed']);
  assert.throws(() => restarted.submit(h.ctx, h.caps, key, raw), code('attempt_unresolved'));
  assert.equal(restarted.state.dispatches, 1);
});
test('N20 crash before effect leaves uncertainty; missing provider record is no negative proof', t => {
  const h = harness(t), key = randomUUID();
  assert.throws(() => h.server.submit(h.ctx, h.caps, key, h.raw(['goods-a']), { crash: 'before_effect' }), SimulatedCrash);
  const restarted = new CancellationSimulator({ file: h.file });
  const a = restarted.lookup(h.ctx, h.caps, key).modification;
  restarted.reconcile(business(), a.modification_id);
  assert.deepEqual(outcomes(restarted.get(h.ctx, h.caps, a.modification_id)), ['indeterminate']);
  const raw = request(restarted.order(h.ctx, h.caps).order_version, ['goods-a']);
  const fresh = restarted.submit(h.ctx, h.caps, randomUUID(), raw);
  assert.equal(fresh.results[0].reason_code, 'conflicting_modification');
  assert.equal(restarted.state.dispatches, 1);
});
test('N21 independent partial outcomes retain committed, refused, and unknown units', t => {
  const h = harness(t, {}, c => { c.units[1].supported = true; c.units[2].supported = true; c.units[1].policy = false; });
  h.server.faults.delivery = 'unknown';
  const a = h.send(['goods-a', 'goods-b', 'delivery']);
  assert.deepEqual(outcomes(a.result), ['committed', 'refused', 'indeterminate']);
  assert.equal(a.result.status, 'open'); assert.equal(h.server.state.dispatches, 2);
});
test('N22 known non-execution is failed; unknown execution stays indeterminate', t => {
  const h = harness(t); h.server.faults['goods-a'] = 'fail'; h.server.faults['goods-b'] = 'unknown';
  const a = h.send(['goods-a', 'goods-b']);
  assert.deepEqual(outcomes(a.result), ['failed', 'indeterminate']);
  assert.equal(h.server.order(h.ctx, h.caps).adjustments.length, 0);
});
test('N23 published MSE dependency refusal names missing unit before any dispatch', t => {
  const h = harness(t, {}, c => { c.units[0].requires = ['goods-b']; });
  const a = h.send(['goods-a']);
  const stored = h.server.state.attempts[a.result.modification_id];
  assert.equal(stored.admission.kind, 'ADMISSION_REFUSED');
  assert.equal(stored.admission.admissionRefusal.failures[0].witness.requiredTransitions[0].unitLocator.unitKey, 'goods-b');
  assert.equal(h.server.state.dispatches, 0);
});
test('N24 published MSE admission pass grants no policy approval or execution', t => {
  const h = harness(t, { review: true }, c => { c.units[0].requires = ['goods-b']; });
  const a = h.send(['goods-a', 'goods-b']);
  assert.equal(h.server.state.attempts[a.result.modification_id].admission.kind, 'ADMISSION_PASSED');
  assert.deepEqual(outcomes(a.result), ['committed', 'awaiting_business_decision']);
});
test('N25 revoked manage scope blocks replay despite admission having passed', t => {
  const h = harness(t), a = h.send(['goods-a']);
  assert.throws(() => h.server.submit({ ...h.ctx, scopes: [READ] }, h.caps, a.key, a.body), code('unauthorized'));
  assert.throws(() => h.server.submit({ ...h.ctx, buyer: 'intruder' }, h.caps, a.key, a.body), code('unauthorized'));
});
test('N26 cross-platform lookup and get never expose another attempt', t => {
  const h = harness(t), a = h.send(['goods-a']), other = { ...h.ctx, platform: 'platform-b' };
  assert.equal(h.server.lookup(other, h.caps, a.key).status, 'unresolved');
  assert.throws(() => h.server.get(other, h.caps, a.result.modification_id), code('unknown_attempt'));
});
test('N27 uncertain refund does not become zero or reverse cancellation commitment', t => {
  const h = harness(t), a = h.send(['goods-a']), id = a.result.results[0].adjustments[0];
  h.server.settle(business(), id, { status: 'unknown' });
  assert.deepEqual(h.server.refundView(h.ctx, id), { determinacy: 'UNKNOWN', status: 'unknown' });
  assert.equal(h.server.get(h.ctx, h.caps, a.result.modification_id).results[0].outcome, 'committed');
});
test('N28 estimated refund, affected amount, and split actual refund remain distinct', t => {
  const h = harness(t), a = h.send(['goods-a']), id = a.result.results[0].adjustments[0];
  h.server.settle(business(), id, { status: 'completed', currency: 'USD', components: [
    { method: 'original_payment', amount: 2400 }, { method: 'loyalty', amount: 200 }, { method: 'store_credit', amount: 50 }
  ] });
  const view = h.server.refundView(h.ctx, id);
  assert.equal(view.amount, 2650); assert.equal(a.result.results[0].affected_amount, 3000);
  assert.equal(h.server.unit('goods-a').estimate, 2700);
  assert.equal(h.server.order(h.ctx, h.caps).adjustments[0].totals[0].amount, -2650);
  assert.equal(view.components.length, 3);
});
test('N29 wrong-currency, floating-point, and unsafe refund observations fail closed', t => {
  const h = harness(t), id = h.send(['goods-a']).result.results[0].adjustments[0];
  for (const [currency, amount] of [['EUR', 30], ['USD', 0.1], ['USD', Number.MAX_SAFE_INTEGER + 1]])
    assert.throws(() => h.server.settle(business(), id, { status: 'completed', currency, components: [{ method: 'original_payment', amount }] }), code('invalid_observation'));
  assert.equal(h.server.refundView(h.ctx, id).determinacy, 'UNKNOWN');
});
test('N30 zero refund is explicitly determined only after final observation', t => {
  const h = harness(t, {}, c => { delete c.units[0].estimate; }), id = h.send(['goods-a']).result.results[0].adjustments[0];
  assert.equal(h.server.refundView(h.ctx, id).amount, undefined);
  h.server.settle(business(), id, { status: 'completed', currency: 'USD', components: [{ method: 'store_credit', amount: 0 }] });
  assert.equal(h.server.refundView(h.ctx, id).determinacy, 'DETERMINED');
  assert.equal(h.server.refundView(h.ctx, id).amount, 0);
});
test('N31 storage outage blocks claims, reads, and dispatch', t => {
  const h = harness(t), raw = h.raw(['goods-a']); h.server.storageDown = true;
  assert.throws(() => h.server.submit(h.ctx, h.caps, randomUUID(), raw), code('storage_unavailable'));
  assert.throws(() => h.server.lookup(h.ctx, h.caps, randomUUID()), code('storage_unavailable'));
  assert.equal(h.server.state.dispatches, 0); assert.equal(Object.keys(h.server.state.claims).length, 0);
});
test('N32 fence is explicit mutation; delayed original can never dispatch in the simulator', t => {
  const h = harness(t), key = randomUUID(), raw = h.raw(['goods-a']);
  assert.equal(h.server.lookup(h.ctx, h.caps, key).status, 'unresolved');
  assert.equal(h.server.fence(h.ctx, h.caps, randomUUID(), key).key_fenced, true);
  assert.throws(() => h.server.submit(h.ctx, h.caps, key, raw), code('key_fenced'));
  const restarted = new CancellationSimulator({ file: h.file });
  assert.equal(restarted.lookup(h.ctx, h.caps, key).key_fenced, true); assert.equal(restarted.state.dispatches, 0);
});
test('N33 expired record retains claim; neither replay nor fencing proves non-execution', t => {
  const h = harness(t), a = h.send(['goods-a']); h.server.advance(31 * 86400000);
  assert.equal(h.server.lookup(h.ctx, h.caps, a.key).reason_code, 'record_expired');
  assert.equal(h.server.fence(h.ctx, h.caps, randomUUID(), a.key).reason_code, 'record_expired');
  assert.throws(() => h.server.submit(h.ctx, h.caps, a.key, a.body), code('attempt_unresolved'));
  assert.equal(h.server.state.dispatches, 1);
});
test('N34 client blocks fresh overlapping attempt after loss and recovery performs reads only', t => {
  const h = harness(t), client = new CancellationClient(h.server, h.ctx); h.server.faults['goods-a'] = 'unknown'; let key;
  try { client.cancel(h.raw(['goods-a']), { loseResponse: true }); } catch (e) { key = e.attemptKey; }
  assert.throws(() => client.cancel(h.raw(['goods-a'])), code('client_attempt_unresolved'));
  assert.equal(client.recover(key).lookup.modification.status, 'open');
  assert.equal(h.server.state.dispatches, 1);
});
test('N35 malformed, duplicate, mixed order/unit and injected authority fields are rejected', t => {
  const h = harness(t), version = h.server.order(h.ctx, h.caps).order_version;
  for (const raw of [h.raw(['goods-a', 'goods-a']), h.raw(['$order', 'goods-a']),
    JSON.stringify({ base_order_version: version, operations: [], authorized: true })])
    assert.throws(() => h.server.submit(h.ctx, h.caps, randomUUID(), raw), code('invalid_modification_request'));
  assert.equal(h.server.state.dispatches, 0);
});
test('N36 unknown atomicity or target vocabulary never becomes a permissive multi-write', t => {
  const h = harness(t, { atomicity: 'future_group_model' });
  assert.throws(() => h.send(['goods-a', 'goods-b']), code('unsupported_atomicity'));
  assert.equal(h.server.state.dispatches, 0);
});
test('N37 every visible adjustment change invalidates the previous order version', t => {
  const h = harness(t), a = h.send(['goods-a']), raw = h.raw(['goods-b']);
  h.server.settle(business(), a.result.results[0].adjustments[0], { status: 'pending' });
  assert.throws(() => h.server.submit(h.ctx, h.caps, randomUUID(), raw), code('stale_order_state'));
});
test('N38 fence has a separate operation scope, replays, and rejects conflicting reuse', t => {
  const h = harness(t), original = randomUUID(), fenceKey = randomUUID();
  const result = h.server.fence(h.ctx, h.caps, fenceKey, original);
  assert.deepEqual(h.server.fence(h.ctx, h.caps, fenceKey, original), result);
  assert.throws(() => h.server.fence(h.ctx, h.caps, fenceKey, randomUUID()), code('idempotency_conflict'));
  assert.equal(h.server.state.dispatches, 0);
});
test('N39 whole-order merchant review is independent of per-unit processing modes', t => {
  const h = harness(t, { review: true });
  const a = h.send(['$order']); assert.deepEqual(outcomes(a.result), ['awaiting_business_decision']);
  assert.equal(h.server.state.dispatches, 0);
  h.server.decide(business(), a.result.modification_id, true);
  assert.equal(h.server.state.dispatches, 1); assert.ok(h.server.state.config.units.every(u => u.canceled));
});
test('N40 atomic group cannot report partial commitment when one simulated backend fails', t => {
  const h = harness(t, { atomicity: 'atomic' }); h.server.faults['goods-b'] = 'fail';
  const a = h.send(['goods-a', 'goods-b']);
  assert.deepEqual(outcomes(a.result), ['failed', 'failed']);
  assert.ok(h.server.state.config.order.line_items.every(l => l.quantity.total > 0));
});
test('N41 hidden authoritative commit is indeterminate until its evidence is readable', t => {
  const h = harness(t); h.server.faults['goods-a'] = 'hidden_commit';
  const a = h.send(['goods-a']); assert.deepEqual(outcomes(a.result), ['indeterminate']);
  h.server.reconcile(business(), a.result.modification_id);
  assert.deepEqual(outcomes(h.server.get(h.ctx, h.caps, a.result.modification_id)), ['indeterminate']);
  h.server.hiddenEvidence.clear(); h.server.reconcile(business(), a.result.modification_id);
  assert.deepEqual(outcomes(h.server.get(h.ctx, h.caps, a.result.modification_id)), ['committed']);
  assert.equal(h.server.state.dispatches, 1);
});
test('N42 mutual negotiation requires a supported parent and extension version', t => {
  const h = harness(t), noExtension = new CancellationClient(h.server, h.ctx, [h.caps[0]]);
  assert.equal(noExtension.read().modification, undefined);
  assert.equal(noExtension.read().order_version, undefined);
  assert.throws(() => h.server.submit(h.ctx, h.caps.filter(c => c.name === CAPABILITY), randomUUID(), h.raw(['goods-a'])), code('modification_not_supported'));
});
test('N43 approving a pending sibling never redispatches an already indeterminate unit', t => {
  const h = harness(t, { review: true }); h.server.faults['goods-a'] = 'unknown';
  const a = h.send(['goods-a', 'goods-b']);
  assert.deepEqual(outcomes(a.result), ['indeterminate', 'awaiting_business_decision']);
  h.server.decide(business(), a.result.modification_id, true);
  assert.equal(h.server.state.dispatches, 2);
  assert.deepEqual(outcomes(h.server.get(h.ctx, h.caps, a.result.modification_id)), ['indeterminate', 'committed']);
});
