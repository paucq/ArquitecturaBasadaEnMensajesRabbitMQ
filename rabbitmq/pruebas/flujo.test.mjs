import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

const api = process.env.API_URL ?? 'http://localhost:3000';
const management = process.env.RABBITMQ_UI_URL ?? 'http://localhost:15672';
const authorization = `Basic ${Buffer.from('admin:admin').toString('base64')}`;
const compose = (...args) => execFileSync('docker', ['compose', ...args], {
  cwd: new URL('../', import.meta.url), encoding: 'utf8',
});

async function broker(path, body) {
  const response = await fetch(`${management}/api/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { authorization, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(response.status, 200);
  return response.json();
}

async function waitForProcessed(orderId) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const logs = compose('logs', '--no-color', 'notification-worker');
    if (logs.split('\n').some(line =>
      line.includes('"event":"order_processed"') && line.includes(orderId))) return;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.fail(`No se observó procesamiento de ${orderId} en 30 segundos`);
}

test('API publica en RabbitMQ y el worker independiente procesa el mismo pedido', async t => {
  // Precondición: el entorno debe estar levantado antes de ejecutar esta prueba.
  compose('stop', 'notification-worker');
  t.after(() => compose('start', 'notification-worker'));
  const customerName = `Prueba-${randomUUID()}`;
  const response = await fetch(`${api}/orders`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ customerName, product: 'Libro de arquitectura', quantity: 1 }),
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(response.status, 202);
  const accepted = await response.json();
  assert.equal(accepted.status, 'accepted');
  assert.ok(accepted.orderId);

  const messages = await broker('queues/%2F/pedidos/get', {
    count: 100, ackmode: 'ack_requeue_true', encoding: 'auto', truncate: 10000,
  });
  const message = messages.find(item => JSON.parse(item.payload).orderId === accepted.orderId);
  assert.ok(message, 'El pedido debe estar almacenado en la cola con el worker apagado');
  assert.equal(JSON.parse(message.payload).customerName, customerName);
  assert.equal(message.properties.delivery_mode, 2);
  assert.equal(message.properties.correlation_id, accepted.orderId);
  const queue = await broker('queues/%2F/pedidos');
  assert.equal(queue.durable, true);
  compose('start', 'notification-worker');
  await waitForProcessed(accepted.orderId);
});

test('API rechaza datos inválidos sin aceptarlos como pedido', async () => {
  const response = await fetch(`${api}/orders`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ customerName: 'Prueba', product: 'Libro', quantity: 0 }),
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(response.status, 400);
});
