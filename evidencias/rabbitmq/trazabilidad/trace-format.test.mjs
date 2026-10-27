import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeTrace, matchingEvents, completeTrace } from './trace-format.mjs';
const id = 'ORD-00000000-0000-4000-8000-000000000001';
function fixture(type, props = {}) {
  return JSON.stringify({ type, queue: type === 'received' ? 'pedidos' : 'none',
    routed_queues: type === 'published' ? ['pedidos'] : 'none',
    properties: { message_id: id, correlation_id: id, ...props },
    payload: Buffer.from(JSON.stringify({ orderId: id })).toString('base64') });
}
test('native JSON lines and base64 payload preserve both broker stages', () => {
  const raw = `${fixture('published')}\n${fixture('received')}\n`;
  assert.equal(decodeTrace(raw)[0].decodedPayload.orderId, id);
  assert.equal(completeTrace(matchingEvents(raw, id)), true);
});
test('missing stage and mismatched ID cannot satisfy contract', () => {
  assert.equal(completeTrace(matchingEvents(fixture('published'), id)), false);
  assert.equal(matchingEvents(fixture('received', { message_id: 'wrong' }), id).length, 0);
  assert.equal(matchingEvents(fixture('received'), 'other').length, 0);
});
test('invalid JSON fails visibly, never substitutes records', () => {
  assert.throws(() => decodeTrace('{broken'), /Invalid native/);
  assert.throws(() => decodeTrace(JSON.stringify({ type: 'received', payload: 'bm90anNvbg==' })), /Invalid native/);
});
