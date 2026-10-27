import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { extractOrderId } from './extract-order-id.mjs';

const fixtures = [
  ['../corrida-02/06-postman-stdout.txt', 'ORD-4cc41fe7-7675-4929-a274-74f02a7b3a1e'],
  ['../../postman-cli/corrida-02-sin-output/stdout.txt', 'ORD-abf9d555-aa78-4f7f-8ff6-ae0a520a816a'],
];
for (const [path, expected] of fixtures) {
  test(`real fixture ${path} => ${expected}`, () => {
    assert.equal(extractOrderId(readFileSync(new URL(path, import.meta.url), 'utf8')), expected);
  });
}
const id = 'ORD-12345678-1234-4123-8123-123456789abc';
const response = body => `  - v application/json * text * json\n${body}\n  -\n`;
test('synthetic UUID split across HTTP body lines', () => {
  assert.equal(extractOrderId(response(
    '  | {"orderId":"ORD-12345678-1234-\n  | 4123-8123-123456789abc"}',
  )), id);
});
test('missing ID fails explicitly', () => {
  assert.throws(() => extractOrderId(response('  | {"status":"accepted"}')), /orderId/);
});
test('test text and request body are not HTTP response evidence', () => {
  assert.throws(() => extractOrderId(
    `  - ^ raw\n  | {"orderId":"${id}"}\n  -\n  Pass orderId ${id}\n`
    + `  | 'HTTP_EVIDENCE {"orderId":"${id}"}'\n`,
  ), /orderId/);
});
test('reject malformed UUID, non-string, nested ID and malformed JSON', () => {
  for (const body of [
    '{"orderId":"ORD-12345678-1234-4123-8123-123456789abz"}',
    '{"orderId":123}', `{"nested":{"orderId":"${id}"}}`,
    `{"orderId":"${id}"`,
  ]) assert.throws(() => extractOrderId(response(`  | ${body}`)), /orderId|JSON/);
});
test('multiple response IDs are ambiguous', () => {
  assert.throws(() => extractOrderId(
    response(`  | {"orderId":"${id}"}`)
    + response('  | {"orderId":"ORD-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}'),
  ), /orderId/);
});
