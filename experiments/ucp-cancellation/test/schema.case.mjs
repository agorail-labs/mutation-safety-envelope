import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { CancellationSimulator } from '../src/simulator.mjs';
import { buyer, business, fixture, request } from '../src/fixtures.mjs';
import { randomUUID } from 'node:crypto';

const load = p => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const ajv = new Ajv2020({ strict: false, allErrors: true }); addFormats(ajv);
const schema = load('../evidence/pinned-fragments.schema.json'); ajv.addSchema(schema);
for (const s of load('../evidence/current-adjustment-schemas.json')) ajv.addSchema(s);
const validate = (def, value) => {
  const check = ajv.getSchema(`${schema.$id}#/$defs/${def}`);
  assert.ok(check(value), JSON.stringify(check.errors));
};

test('S01 executable read declarations and requests match pinned PR945 fragment shapes', t => {
  const dir = mkdtempSync(join(tmpdir(), 'cancel-schema-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const granularity of ['order_only', 'by_unit']) {
    const s = new CancellationSimulator({ file: join(dir, `${granularity}.json`), config: fixture({ granularity }) });
    const o = s.order(buyer(), s.profile()); validate('modification_declaration', o.modification);
    const raw = request(o.order_version, [granularity === 'order_only' ? '$order' : 'goods-a']);
    validate('create_request', JSON.parse(raw));
    validate('modification_record', s.submit(buyer(), s.profile(), randomUUID(), raw));
  }
});
test('S02 mixed and pending records match pinned draft shapes; atomic partial success is rejected', t => {
  const dir = mkdtempSync(join(tmpdir(), 'cancel-schema-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const s = new CancellationSimulator({ file: join(dir, 'state.json'), config: fixture({ review: true }) });
  const raw = request(s.order(buyer(), s.profile()).order_version, ['goods-a', 'goods-b']);
  const r = s.submit(buyer(), s.profile(), randomUUID(), raw);
  validate('modification_record', r);
  const invalid = structuredClone(r); invalid.atomicity = 'atomic';
  assert.equal(ajv.getSchema(`${schema.$id}#/$defs/modification_record`)(invalid), false);
});
test('S03 uncertain and final refunds preserve current UCP adjustment schema', t => {
  const dir = mkdtempSync(join(tmpdir(), 'cancel-schema-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const s = new CancellationSimulator({ file: join(dir, 'state.json'), config: fixture() });
  const raw = request(s.order(buyer(), s.profile()).order_version);
  const r = s.submit(buyer(), s.profile(), randomUUID(), raw), id = r.results[0].adjustments[0];
  const check = ajv.getSchema('https://ucp.dev/schemas/shopping/types/adjustment.json');
  for (const obs of [{ status: 'unknown' }, { status: 'completed', currency: 'USD', components: [{ method: 'original_payment', amount: 2600 }] }]) {
    s.settle(business(), id, obs);
    const a = s.order(buyer(), s.profile()).adjustments[0];
    assert.ok(check(a), JSON.stringify(check.errors));
    assert.ok(['pending', 'completed', 'failed'].includes(a.status));
  }
});
