import test from 'node:test';
import assert from 'node:assert/strict';
import { Machine, Decoder, cleanupAction, queueIs, postmanCommand, executionAllowed } from './cp12-core.mjs';
import { extractOrderId } from '../consumidores-apagados/herramientas/extract-order-id.mjs';
const id = 'ORD-12345678-1234-1234-1234-123456789abc';
const other = 'ORD-12345678-1234-1234-1234-123456789abd';
const since = '2026-10-27T04:00:00.000Z';
const event = (kind = 'order_received', extra = {}) => ({ timestamp: since, instance: 'target', event: kind, orderId: id, correlationId: id, redelivered: false, ...extra });
const q = { durable: true, messages_ready: 0, messages_unacknowledged: 1, messages: 1, consumers: 1 };
function armed() { const m = new Machine(since, 'target'); m.publish(); m.event(event()); m.stop(100); return m; }
test('Postman command selects only the known local request with -i', () => {
  const argv = postmanCommand('/tmp/collection.json');
  assert.deepEqual(argv.slice(0, 6), ['postman', 'collection', 'run', '/tmp/collection.json', '-i', 'Crear pedido — esperado HTTP 202']);
  assert.equal(argv.includes('--output'), false);
  assert.equal(argv.includes('--folder'), false);
  assert.equal(executionAllowed(['--execute-ack-recovery']), true);
  assert.equal(executionAllowed([]), false);
  assert.equal(executionAllowed(['--execute-ack-recovery', '--again']), false);
});
test('decoder handles timestamps, fragmented UTF8 and EOF', () => {
  const out = []; const d = new Decoder(x => out.push(x));
  const b = Buffer.from(`${since} ${JSON.stringify(event('worker_ready', { text: 'ñ' }))}\n`);
  for (const byte of b) d.push(Buffer.from([byte])); d.end(); assert.equal(out[0].text, 'ñ');
  const broken = new Decoder(() => {}); broken.push(Buffer.from('{')); assert.throws(() => broken.end(), /incomplete/);
});
test('old logs ignored; one fresh receive; single publish', () => {
  const m = new Machine(since, 'target'); m.publish(); assert.throws(() => m.publish(), /once/);
  assert.equal(m.event(event('order_received', { timestamp: '2026-10-26T00:00:00Z' })), false);
  assert.equal(m.event(event()), true); assert.throws(() => m.event(event('order_received', { orderId: other, correlationId: other })), /multiple/);
});
test('gate requires STOP, HTTP match, API publication, queue and deadline', () => {
  const m = armed(); assert.throws(() => m.gate(q, 101), /HTTP/);
  assert.throws(() => m.http(other), /mismatch/); m.http(id);
  assert.throws(() => m.gate(q, 101), /publication/); m.publication(event('order_published'));
  assert.throws(() => m.gate({ ...q, messages_ready: 1 }, 101), /queue/);
  assert.throws(() => m.gate(q, 12100), /deadline/); m.gate(q, 102); m.fault(); m.eof();
});
test('processed before STOP or after STOP forbids fault; EOF before fault fails', () => {
  const m = new Machine(since, 'target'); m.publish(); m.event(event('order_processed')); assert.throws(() => m.event(event()), /processed/);
  const n = armed(); n.event(event('order_processed')); n.http(id); n.publication(event('order_published')); assert.throws(() => n.gate(q, 101), /processed/);
  assert.throws(() => armed().eof(), /EOF/); assert.throws(() => armed().fault(), /gate/);
});
test('only fresh redelivered true followed by processed qualifies recovery', () => {
  const m = armed(); m.http(id); m.publication(event('order_published')); m.gate(q, 101); m.fault();
  m.recovery(event()); assert.equal(m.recovered, false);
  m.recovery(event('order_processed', { redelivered: true })); assert.equal(m.recovered, false);
  m.recovery(event('order_received', { redelivered: true }));
  m.recovery(event('order_processed', { redelivered: true })); assert.equal(m.recovered, true);
});
test('scope mismatch refuses cleanup; no duplicate start on running', () => {
  const s = { Id: 'full', Config: { Labels: { 'com.docker.compose.project': 'project' } }, State: { Running: true, Paused: false, Status: 'running' } };
  assert.equal(cleanupAction(s, 'full', 'project', true), 'continue');
  assert.equal(cleanupAction(s, 'full', 'project', false), null);
  assert.throws(() => cleanupAction(s, 'changed', 'project', true), /scope/);
  assert.equal(cleanupAction({ ...s, State: { Running: false, Status: 'exited' } }, 'full', 'project', false), 'start');
});
test('HTTP wrapped UUID and multiple IDs; strict queue', () => {
  const body = x => `- v application/json\n| {"orderId":"${x.slice(0, 19)}\n| ${x.slice(19)}"}\n`;
  assert.equal(extractOrderId(body(id)), id); assert.throws(() => extractOrderId(body(id) + body(other)), /exactly one/);
  assert.equal(queueIs(q, 0, 1, 1, 1), true); assert.equal(queueIs({ ...q, durable: false }, 0, 1, 1, 1), false);
});
