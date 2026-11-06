import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CancellationSimulator, CancellationClient, LostResponse } from './src/simulator.mjs';
import { fixture, buyer, business, request } from './src/fixtures.mjs';

const dir = mkdtempSync(join(tmpdir(), 'ucp-cancellation-demo-'));
try {
  const server = new CancellationSimulator({ file: join(dir, 'state.json'), config: fixture({ review: true }) });
  const client = new CancellationClient(server, buyer());
  console.log('EXPERIMENTAL local simulator; no UCP standard or merchant service is implemented.');
  const before = client.read();
  console.log('Negotiated declaration:', JSON.stringify(before.modification));
  let key;
  try { client.cancel(request(before.order_version, ['goods-a', 'goods-b']), { loseResponse: true }); }
  catch (e) { if (!(e instanceof LostResponse)) throw e; key = e.attemptKey; console.log('Submission response lost. Recover by read, with original key.'); }
  const recovered = client.recover(key);
  console.log('Recovered exact attempt:', JSON.stringify(recovered.lookup.modification));
  console.log('Dispatches after recovery:', server.state.dispatches);
  const id = recovered.lookup.modification.modification_id;
  server.decide(business(), id, true);
  const complete = client.recover(key);
  console.log('Merchant decision:', JSON.stringify(complete.lookup.modification));
  const adj = complete.lookup.modification.results[0].adjustments[0];
  console.log('Cancellation committed; refund:', JSON.stringify(server.refundView(buyer(), adj)));
  server.settle(business(), adj, { status: 'unknown' });
  console.log('Uncertain settlement:', JSON.stringify(server.refundView(buyer(), adj)));
  server.settle(business(), adj, { status: 'completed', currency: 'USD', components: [
    { method: 'original_payment', amount: 2400 }, { method: 'loyalty', amount: 200 }, { method: 'store_credit', amount: 50 }
  ] });
  console.log('Simulated authoritative financial observation:', JSON.stringify(server.refundView(buyer(), adj)));
} finally { rmSync(dir, { recursive: true, force: true }); }
