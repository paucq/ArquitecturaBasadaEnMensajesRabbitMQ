// Validación documental offline; no servicios ni salida de archivos.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { extractOrderId } from '../consumidores-apagados/herramientas/extract-order-id.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const read = path => readFileSync(resolve(here, path), 'utf8');
const run = '../consumidores-apagados/corrida-03/';
const id = 'ORD-b7a74952-2957-49cb-a5db-f88d7b2ce443';
const stdout = read(run + '06-postman-stdout.txt');
assert.equal(extractOrderId(stdout), id);
assert.match(stdout, /202 Accepted \* 27 ms/);
assert.match(stdout, /assertions \|\s+4 \|\s+0/);
assert.equal(read(run + '06-postman-exitcode.txt').trim(), '0');
const baseline = JSON.parse(read(run + 'baseline.json'));
assert.equal(baseline.consumers, 0);
assert.equal(baseline.messages_ready, 0);
const final = JSON.parse(read(run + 'consumo-posterior/resultado-final.json'));
assert.equal(final.orderId, id);
assert.equal(final.before.consumers, 0);
assert.equal(final.before.messages_ready, 1);
assert.equal(final.final.messages, 0);
assert.equal(final.final.consumers, 2);
const events = read(run + 'consumo-posterior/logs-mismo-id-notification-worker.txt')
  .trim().split('\n').map(line => JSON.parse(line.slice(line.indexOf('{'))));
assert(events.every(event => event.orderId === id && event.instance === 'aea9d0d7aa00'));
const received = events.find(event => event.event === 'order_received');
const processed = events.find(event => event.event === 'order_processed');
assert.equal(received.timestamp, '2026-10-27T01:46:31.200Z');
assert.equal(processed.timestamp, '2026-10-27T01:46:34.229Z');
assert.equal(Date.parse(received.timestamp) - Date.parse(final.published_utc), 411573);
assert.equal(Date.parse(processed.timestamp) - Date.parse(received.timestamp), 3029);
assert(read(run + 'logs-mismo-id.txt').includes(final.published_utc));
const report = read('reporteCP07.md');
const fields = ['ID del caso', 'Arquitectura', 'Objetivo', 'Precondiciones', 'Datos de entrada', 'Pasos ejecutados', 'Resultado esperado', 'Resultado obtenido', 'Evidencia (capturas)', 'Estado', 'Análisis técnico'];
for (const field of fields) assert(report.includes('- ' + field + ':'));
assert(report.includes('- Estado: Cumple.'));
for (const document of ['reporteCP07.md', 'RESUMEN.md']) {
  for (const match of read(document).matchAll(/\]\(([^)]+)\)/g)) {
    // check.json is the capture of this very execution, written by its caller.
    if (match[1] === 'check.json') continue;
    assert(existsSync(resolve(here, decodeURIComponent(match[1]))), match[1]);
  }
}
const plan = read('../../../PLAN_DE_TRABAJO.md');
const rows = plan.split('\n').filter(line => /^\| CP-\d+ —/.test(line));
assert.equal(rows.filter(line => line.split('|')[3].trim() === '[x]').length, 7);
assert(rows.every(line => line.split('|')[4].trim() !== '[x]'));
for (const number of ['08', '09', '12']) assert(rows.find(line => line.startsWith('| CP-' + number)).includes('| [ ] | [ ] |'));
console.log(JSON.stringify({ status: 'pass', orderId: id, fields: fields.length, publicationToReceivedMs: 411573, processingMs: 3029, rabbitmqCompleted: 7, runtimeOperations: 0 }));
