import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import assert from 'node:assert/strict';
import { extractOrderId } from '../consumidores-apagados/herramientas/extract-order-id.mjs';
import { matchingEvents, completeTrace } from './trace-format.mjs';
const base = dirname(fileURLToPath(import.meta.url));
const cwd = resolve(base, '../../../rabbitmq');
const out = resolve(base, 'corrida-01');
if (existsSync(out)) throw new Error('One live attempt only; directory already exists');
mkdirSync(out);
const save = (name, value) => writeFileSync(resolve(out, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2));
const compose = ['compose', '-p', 'qa-taller-integracion-rabbitmq'];
let seq = 0;
function command(label, exe, args, allowed = [0]) {
  const stem = `${String(++seq).padStart(3, '0')}-${label}`;
  const start = new Date().toISOString();
  const r = spawnSync(exe, args, { cwd, encoding: 'utf8', timeout: 45000, maxBuffer: 16 * 1024 * 1024 });
  save(`${stem}-stdout.txt`, r.stdout ?? '');
  save(`${stem}-stderr.txt`, r.stderr ?? '');
  save(`${stem}-execution.json`, { cwd, command: [exe, ...args], start, end: new Date().toISOString(), exitcode: r.status, signal: r.signal, error: r.error?.message });
  if (!allowed.includes(r.status)) throw new Error(`${stem} exitcode ${r.status}: ${r.error?.message ?? r.stderr}`);
  return r.stdout;
}
const dc = (label, args) => command(label, 'docker', [...compose, ...args]);
function parse(text) { try { return JSON.parse(text); } catch (cause) { throw new Error('Invalid JSON evidence', { cause }); } }
function api(label, path, method = 'GET', body, statuses = [200]) {
  const args = ['-sS', '--max-time', '12', '-u', 'admin:admin', '-X', method, '-w', '\n%{http_code}', `http://localhost:15672/api/${path}`];
  if (body) args.push('-H', 'Content-Type: application/json', '--data', JSON.stringify(body));
  const text = command(label, 'curl', args);
  const split = text.lastIndexOf('\n');
  const status = Number(text.slice(split + 1));
  if (!statuses.includes(status)) throw new Error(`${label} HTTP ${status}`);
  return { status, body: text.slice(0, split) };
}
const jsonApi = (label, path) => parse(api(label, path).body);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const name = `CP06-${new Date().toISOString().replace(/[:.]/g, '-')}`;
let initial, enabledByUs = false, traceAttempted = false, id, failure;
let copied = false;
const started = new Date().toISOString();
function snapshot(prefix, tracesOptional = false) {
  const ps = dc(`${prefix}-compose`, ['ps', '--format', 'json']).trim().split('\n').map(parse);
  const plugins = dc(`${prefix}-plugins`, ['exec', '-T', 'rabbitmq', 'rabbitmq-plugins', 'list', '-e']);
  const overview = jsonApi(`${prefix}-overview`, 'overview');
  const vhosts = jsonApi(`${prefix}-vhosts`, 'vhosts');
  const queue = jsonApi(`${prefix}-queue`, 'queues/%2F/pedidos');
  const traces = api(`${prefix}-traces`, 'traces', 'GET', undefined, tracesOptional ? [200, 404] : [200]);
  const health = command(`${prefix}-health`, 'curl', ['-fsS', '--max-time', '10', 'http://localhost:3000/health']);
  const state = { ps, plugins, version: overview.rabbitmq_version, vhosts, queue, traces, health: parse(health) };
  save(`${prefix}-state.json`, state);
  return state;
}
try {
  command('node-version', 'node', ['--version']);
  command('postman-version', 'postman', ['--version']);
  command('offline-tests', 'node', ['--test', resolve(base, 'trace-format.test.mjs')]);
  command('official-format-source', 'curl', ['-fsS', '--max-time', '15', 'https://raw.githubusercontent.com/rabbitmq/rabbitmq-server/v4.4.0/deps/rabbitmq_tracing/src/rabbit_tracing_consumer.erl']);
  initial = snapshot('initial', true);
  assert.equal(initial.version, '4.4.0');
  assert.equal(initial.ps.filter(p => p.Service === 'notification-worker' && p.State === 'running').length, 2);
  assert.equal(initial.ps.filter(p => ['orders-api', 'rabbitmq'].includes(p.Service) && p.Health === 'healthy').length, 2);
  assert.equal(initial.health.status, 'ready');
  assert.equal(initial.queue.consumers, 2);
  assert.equal(initial.queue.messages, 0);
  assert.equal(initial.queue.durable, true);
  // A pre-existing firehose is not ours to stop. Traces are never overwritten.
  if (!/\[[Ee]\*?\]\s+rabbitmq_tracing\s/.test(initial.plugins)) {
    enabledByUs = true;
    dc('enable-tracing-online', ['exec', '-T', 'rabbitmq', 'rabbitmq-plugins', 'enable', 'rabbitmq_tracing']);
  }
  const previous = jsonApi('traces-before-create', 'traces');
  save('previous-traces.json', previous);
  assert.ok(!previous.some(t => t.name === name));
  save('trace-identity.json', { name, vhost: '/', pattern: '#', started });
  traceAttempted = true;
  api('create-own-trace', `traces/%2F/${name}`, 'PUT', { format: 'json', pattern: '#', tracer_connection_username: 'admin', tracer_connection_password: 'admin' }, [201, 204]);
  const ready = jsonApi('trace-ready', `traces/%2F/${name}`);
  assert.equal(ready.name, name);
  assert.equal(ready.pattern, '#');
  assert.ok(ready.queue, 'native tracer consumer must be ready');
  assert.equal(jsonApi('vhost-tracing-ready', 'vhosts').find(v => v.name === '/').tracing, true);
  const stdout = command('postman-single-request', 'postman', ['collection', 'run', 'pruebas/RabbitMQ.postman_collection.json', '-i', 'Crear pedido — esperado HTTP 202', '--no-report-events', '--verbose', '--timeout', '30000', '--timeout-request', '10000', '--timeout-script', '5000']);
  id = extractOrderId(stdout);
  save('orderId.txt', id + '\n');
  const deadline = Date.now() + 60000;
  let done = false;
  while (Date.now() < deadline) {
    const listing = jsonApi('wait-trace-files', 'trace-files');
    const own = listing.find(f => f.name === `${name}.log`);
    if (own) {
      const raw = api('native-broker-file', `trace-files/${encodeURIComponent(own.name)}`).body;
      save('broker-native-original.jsonl', raw);
      copied = raw.length > 0;
      const matches = matchingEvents(raw, id);
      save('broker-decoded-DERIVED.json', matches);
      const logs = dc('wait-app-logs', ['logs', '--no-color', '--timestamps', '--since', started, 'orders-api', 'notification-worker']);
      if (completeTrace(matches) && ['order_published', 'order_received', 'order_processed'].every(event => logs.split('\n').some(line => line.includes(id) && line.includes(event)))) {
        done = true;
        break;
      }
    }
    await sleep(1500);
  }
  assert.ok(done, '60s deadline exceeded; no republish');
  jsonApi('trace-metadata-after-order', `traces/%2F/${name}`);
  jsonApi('trace-files-after-order', 'trace-files');
  save('technical-result.json', { id, brokerStagesVerified: true, completed: new Date().toISOString(), copied });
} catch (error) {
  failure = error;
  save('FAILURE.txt', `${error.stack}\nNo automatic retry or republish.\n`);
} finally {
  // Export before deleting the owned trace, including a failed attempt.
  if (traceAttempted) {
    try {
      const r = api('export-before-cleanup', `trace-files/${encodeURIComponent(name + '.log')}`, 'GET', undefined, [200, 404]);
      if (r.status === 200) { save('broker-native-original.jsonl', r.body); copied = r.body.length > 0; }
    } catch (e) { save('export-cleanup-error.txt', e.stack); failure ??= e; }
  }
  for (const service of ['orders-api', 'notification-worker', 'rabbitmq']) {
    try {
      const logs = dc(`final-logs-${service}`, ['logs', '--no-color', '--timestamps', '--since', started, service]);
      if (id) save(`logs-${service}-same-id.txt`, logs.split('\n').filter(line => line.includes(id)).join('\n') + '\n');
    } catch (e) { save(`logs-${service}-error.txt`, e.stack); failure ??= e; }
  }
  if (traceAttempted) {
    try { api('delete-only-own-trace', `traces/%2F/${name}`, 'DELETE', undefined, [204, 404]); }
    catch (e) { save('delete-trace-error.txt', e.stack); failure ??= e; }
  }
  if (initial) {
    try {
      const remaining = enabledByUs || initial.traces.status === 200 ? jsonApi('remaining-traces', 'traces') : [];
      const wasTracing = initial.vhosts.find(v => v.name === '/').tracing;
      if (traceAttempted && !wasTracing && !remaining.some(t => t.vhost === '/')) {
        dc('restore-firehose-off', ['exec', '-T', 'rabbitmq', 'rabbitmqctl', 'trace_off', '-p', '/']);
      }
      if (enabledByUs) {
        assert.equal(remaining.length, 0, 'Do not disable plugin with foreign traces');
        dc('restore-plugin-disabled', ['exec', '-T', 'rabbitmq', 'rabbitmq-plugins', 'disable', 'rabbitmq_tracing']);
      }
      const final = snapshot('final', true);
      assert.equal(final.plugins, initial.plugins);
      assert.deepEqual(final.vhosts.map(v => [v.name, v.tracing]), initial.vhosts.map(v => [v.name, v.tracing]));
      assert.equal(final.ps.filter(p => p.Service === 'notification-worker' && p.State === 'running').length, 2);
      assert.equal(final.queue.consumers, 2);
      assert.equal(final.queue.messages, 0);
      save('cleanup-verification.json', { restoredPlugins: true, restoredFirehose: true, workersRunning: 2, consumers: final.queue.consumers, ready: final.queue.messages_ready, unacked: final.queue.messages_unacknowledged, total: final.queue.messages, diagnosticFileRetainedInBroker: name + '.log', localCopyNonempty: copied });
    } catch (e) { save('cleanup-verification-error.txt', e.stack); failure ??= e; }
  }
  save('attempt-result.json', { id, failure: failure?.message ?? null, finished: new Date().toISOString(), copied });
}
if (failure) { console.error(failure); process.exitCode = 1; }
else console.log(`CP06 technical evidence captured: ${id}; cleanup verified.`);
