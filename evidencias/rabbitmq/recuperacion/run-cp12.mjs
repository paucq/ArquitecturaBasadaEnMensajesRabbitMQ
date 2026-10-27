import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { Machine, Decoder, cleanupAction, queueIs, postmanCommand, executionAllowed } from './cp12-core.mjs';
import { extractOrderId } from '../consumidores-apagados/herramientas/extract-order-id.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const base = resolve(here, '../../..');
const project = 'qa-taller-integracion-rabbitmq';
const format = '{"Id":{{json .Id}},"Name":{{json .Name}},"Config":{"Labels":{{json .Config.Labels}}},"State":{{json .State}},"RestartPolicy":{{json .HostConfig.RestartPolicy}}}';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const must = (ok, message) => { if (!ok) throw new Error(message); };
function parseJSON(text) {
  try { return JSON.parse(text); } catch (cause) { throw new Error('Invalid JSON evidence', { cause }); }
}

/** No runtime work on import; only the guarded CLI below invokes this function. */
async function run() {
  const dir = join(here, 'corrida-01');
  mkdirSync(dir); // EEXIST is fatal: never overwrite or silently allocate another trial.
  let serial = 0, fatal, cancelled = false, cleaning = false, cleanupDeadline = Infinity;
  let stopIntent = false, peerIntent = false, machine, watcher, freezePromise, postmanPromise;
  let original = [], target, peer, trialUTC;
  const children = new Set();
  const result = { state: 'RUNNING', visualEvidence: 'PENDIENTE', publishedInvocations: 0, cleanup: [] };
  const save = (name, value) => writeFileSync(join(dir, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2));
  const intent = (action, data = {}) => appendFileSync(join(dir, 'intent.jsonl'), JSON.stringify({ utc: new Date().toISOString(), monotonicMs: performance.now(), action, ...data }) + '\n');
  const fail = error => { fatal ??= error instanceof Error ? error : new Error(String(error)); };
  const check = () => {
    if (cleaning) must(performance.now() < cleanupDeadline, 'cleanup deadline');
    else if (fatal || cancelled) throw fatal ?? new Error('cancelled');
  };
  const onSignal = signal => { cancelled = true; intent('CANCEL', { signal }); fail(new Error(signal)); };
  const onINT = () => onSignal('SIGINT'); const onTERM = () => onSignal('SIGTERM');
  process.on('SIGINT', onINT); process.on('SIGTERM', onTERM);
  const outer = setTimeout(() => { fail(new Error('operation deadline 125s')); for (const c of children) c.kill('SIGKILL'); }, 125000);

  function command(argv, timeout = 12000, onChunk) {
    check();
    if (cleaning) timeout = Math.max(1, Math.min(timeout, cleanupDeadline - performance.now()));
    const n = String(++serial).padStart(3, '0');
    const record = { argv, started: new Date().toISOString(), startMonotonicMs: performance.now(), timeoutMs: timeout };
    intent('COMMAND', { n, argv }); save(`${n}.command.json`, record);
    return new Promise((resolveCommand, reject) => {
      let child, timer, error, timedOut = false, stdout = '', stderr = '';
      try { child = spawn(argv[0], argv.slice(1), { cwd: base, stdio: ['ignore', 'pipe', 'pipe'] }); }
      catch (cause) { reject(cause); return; }
      children.add(child);
      timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeout);
      child.on('error', cause => { error = cause.message; });
      child.stdout.on('data', b => {
        stdout += b.toString(); appendFileSync(join(dir, `${n}.stdout.txt`), b);
        if (onChunk) { try { onChunk(b); } catch (cause) { fail(cause); } }
      });
      child.stderr.on('data', b => { stderr += b.toString(); appendFileSync(join(dir, `${n}.stderr.txt`), b); });
      child.on('close', (exitcode, signal) => {
        clearTimeout(timer); children.delete(child);
        Object.assign(record, { finished: new Date().toISOString(), durationMs: performance.now() - record.startMonotonicMs, exitcode, signal, timedOut, error });
        // Empty streams are explicit, too. Byte-exact chunks above are not rewritten.
        if (!stdout) save(`${n}.stdout.txt`, ''); if (!stderr) save(`${n}.stderr.txt`, '');
        save(`${n}.command.json`, record);
        if (exitcode !== 0 || timedOut || error) reject(new Error(`command ${n} failed: ${error ?? exitcode}, timeout=${timedOut}`));
        else resolveCommand(stdout);
      });
    });
  }
  const docker = (...args) => command(['docker', ...args]);
  async function scope() {
    const ids = (await docker('ps', '-aq', '--no-trunc', '--filter', `label=com.docker.compose.project=${project}`)).trim().split(/\s+/).filter(Boolean).sort();
    must(ids.length === 4, 'scope must contain exactly four containers');
    const snapshots = [];
    for (const id of ids) snapshots.push(parseJSON(await docker('inspect', '--format', format, id)));
    if (original.length) must(JSON.stringify(ids) === JSON.stringify(original.map(s => s.Id).sort()), 'container IDs changed; no replacement may be touched');
    for (const s of snapshots) must(s.Config.Labels['com.docker.compose.project'] === project, 'project label changed');
    return snapshots;
  }
  async function get(path = '/api/queues/%2F/pedidos') {
    check(); const start = performance.now(); const utc = new Date().toISOString();
    const url = path === '/health' ? `http://127.0.0.1:3000${path}` : `http://127.0.0.1:15672${path}`;
    const n = String(++serial).padStart(3, '0'); intent('GET', { n, url });
    let body, status, error;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000), headers: path === '/health' ? {} : { Authorization: `Basic ${Buffer.from('admin:admin').toString('base64')}` } });
      status = response.status; body = await response.text(); must(response.ok, `GET HTTP ${status}`);
      return JSON.parse(body);
    } catch (cause) { error = cause.message; throw cause; }
    finally { save(`${n}.get.json`, { method: 'GET', url, started: utc, finished: new Date().toISOString(), durationMs: performance.now() - start, status, body, error }); }
  }
  async function waitFor(label, budget, probe) {
    const end = performance.now() + budget;
    while (true) {
      check(); must(performance.now() < end, `${label} deadline`);
      const value = await probe(end); check();
      must(performance.now() < end, `${label} deadline`);
      if (value) return value;
      await pause(Math.min(250, Math.max(0, end - performance.now())));
    }
  }
  async function queueWait(name, budget, counts) {
    const q = await waitFor(name, budget, async () => { const q = await get(); return queueIs(q, ...counts) ? q : null; }); save(`${name}.json`, q); return q;
  }
  function healthy(snapshots) {
    return snapshots.every(s => s.State.Running && !s.State.Paused && (!['orders-api', 'rabbitmq'].includes(s.Config.Labels['com.docker.compose.service']) || s.State.Health?.Status === 'healthy'));
  }
  async function logs(id, since = trialUTC) { return docker('logs', '--timestamps', '--since', since, id); }
  function decode(text, fn) { const d = new Decoder(fn); d.push(Buffer.from(text)); d.end(); }
  async function boundedScope(budgetEnd) {
    // Reserve a full command budget; never spend the STOP window in serial Docker calls.
    must(performance.now() + 2500 < budgetEnd, 'insufficient STOP window for scope check');
    const ids = (await command(['docker', 'ps', '-aq', '--no-trunc', '--filter', `label=com.docker.compose.project=${project}`], 1000)).trim().split(/\s+/).sort();
    must(JSON.stringify(ids) === JSON.stringify(original.map(s => s.Id).sort()), 'scope changed before fault');
    const text = await command(['docker', 'inspect', '--format', format, ...original.map(s => s.Id)], Math.min(1000, budgetEnd - performance.now()));
    const ss = text.trim().split('\n').map(parseJSON);
    must(ss.length === 4 && ss.every((s, i) => s.Id === original[i].Id && s.Config.Labels['com.docker.compose.project'] === project), 'scope changed before fault');
    must(ss.find(s => s.Id === target.Id).State.Running && ss.find(s => s.Id === peer.Id).State.Status === 'exited', 'worker state changed before fault');
    return ss;
  }
  try {
    const ss = await scope(); original = ss; save('original-containers.json', original);
    const services = ss.map(s => s.Config.Labels['com.docker.compose.service']).sort();
    must(JSON.stringify(services) === JSON.stringify(['notification-worker', 'notification-worker', 'orders-api', 'rabbitmq']), 'unexpected services');
    target = ss.find(s => s.Id.startsWith('9daaf02d21e3')); peer = ss.find(s => s.Id.startsWith('aea9d0d7aa00'));
    must(target && peer && ss.some(s => s.Id.startsWith('28a4ac996bc2')) && ss.some(s => s.Id.startsWith('874ff8f0d7a7')), 'stale preflight IDs');
    must(healthy(ss), 'baseline containers not healthy/running');
    must(target.RestartPolicy.Name === 'unless-stopped' && peer.RestartPolicy.Name === 'unless-stopped', 'restart policy mismatch');
    const pid = JSON.parse(await docker('exec', target.Id, 'node', '-e', "const f=require('node:fs');console.log(JSON.stringify({cmdline:f.readFileSync('/proc/1/cmdline','utf8').split('\\0').filter(Boolean),exe:f.readlinkSync('/proc/1/exe')}))"));
    save('pid1.json', pid); must(JSON.stringify(pid.cmdline) === '["node","worker.mjs"]' && pid.exe === '/usr/local/bin/node', 'PID1 not Node worker');
    must((await get('/health')).status === 'ready', 'API health failed');
    const baseline = await get(); save('baseline-queue.json', baseline);
    must(queueIs(baseline, 0, 0, 0, 2) && baseline.consumer_details?.length === 2 && baseline.consumer_details.every(c => c.ack_required && c.prefetch_count === 1), 'baseline queue not isolated');
    peerIntent = true; intent('STOP_PEER', { id: peer.Id });
    await docker('stop', '--timeout', '10', peer.Id); // exit 137 in peer inspect is possible; empty baseline means no lost work.
    await queueWait('peer-stopped-queue', 20000, [0, 0, 0, 1]);
    trialUTC = new Date().toISOString(); machine = new Machine(trialUTC, target.Id.slice(0, 12));
    const decoder = new Decoder(e => {
      if (!machine.faulted && machine.event(e)) {
        // Synchronous callback begins freeze immediately, before awaiting HTTP completion.
        stopIntent = true; machine.stop(performance.now()); intent('SIGSTOP', { id: target.Id, orderId: machine.id });
        freezePromise = command(['docker', 'kill', '--signal', 'SIGSTOP', target.Id], 2000);
        freezePromise.catch(fail);
      }
    });
    // Listener installation is synchronous inside command; no first-line handshake required.
    watcher = command(['docker', 'logs', '--follow', '--timestamps', '--since', trialUTC, target.Id], 100000, b => decoder.push(b));
    watcher.then(() => { if (!cleaning) { try { decoder.end(); machine.eof(); } catch (e) { fail(e); } } }, error => { if (!cleaning) fail(error); });
    machine.publish(); result.publishedInvocations++; intent('POSTMAN_SINGLE_REQUEST');
    postmanPromise = command(postmanCommand(join(base, 'rabbitmq/pruebas/RabbitMQ.postman_collection.json')), 12000);
    postmanPromise.catch(fail);
    const http = await postmanPromise;
    const httpId = extractOrderId(http); result.orderId = httpId;
    must(/\b202\s+Accepted\b/.test(http) && /HTTP 202/.test(http), 'HTTP 202 evidence missing');
    await waitFor('fresh receive', 1000, () => machine.id);
    machine.http(httpId); await freezePromise; check();
    const end = machine.stoppedAt + 12000;
    must(performance.now() < end, 'STOP deadline elapsed');
    const api = original.find(s => s.Config.Labels['com.docker.compose.service'] === 'orders-api');
    const apiLogs = await command(['docker', 'logs', '--timestamps', '--since', trialUTC, api.Id], 1000);
    save('api-before-fault.txt', apiLogs); decode(apiLogs, e => machine.publication(e));
    const preLogs = await command(['docker', 'logs', '--timestamps', '--since', trialUTC, target.Id], 1000);
    save('target-before-fault.txt', preLogs); decode(preLogs, e => machine.event(e));
    const before = await waitFor('Unacked gate', Math.max(1, end - performance.now()), async () => {
      const q = await get(); return queueIs(q, 0, 1, 1, 1) ? q : null;
    });
    save('before-fault-queue.json', before); await boundedScope(end); check(); machine.gate(before, performance.now());
    machine.fault(); intent('ABRUPT_STOP', { id: target.Id });
    await command(['docker', 'stop', '--signal', 'SIGKILL', '--timeout', '0', target.Id], Math.min(1000, Math.max(1, end - performance.now())));
    const afterStop = await scope(); save('after-stop-containers.json', afterStop);
    const dead = afterStop.find(s => s.Id === target.Id);
    must(dead.State.Status === 'exited' && dead.State.ExitCode === 137, 'target did not exit 137');
    await queueWait('after-fault-queue', 20000, [1, 0, 1, 0]);
    // The original watcher may EOF when stopped. Recovery uses cached, bounded logs.
    const restartUTC = new Date().toISOString(); intent('START_TARGET', { id: target.Id }); await docker('start', target.Id); stopIntent = false;
    await waitFor('redelivery and processed', 20000, async () => {
      const text = await logs(target.Id, restartUTC); decode(text, e => machine.recovery(e)); return machine.recovered;
    });
    intent('START_PEER', { id: peer.Id }); await docker('start', peer.Id); peerIntent = false;
    const final = await waitFor('final restoration', 30000, async () => {
      const ss = await scope(); const q = await get(); const health = await get('/health');
      return healthy(ss) && queueIs(q, 0, 0, 0, 2) && health.status === 'ready' ? { containers: ss, queue: q, health } : null;
    });
    save('final.json', final); result.state = 'TECHNICALLY_VERIFIED_VISUAL_PENDING';
  } catch (error) { result.state = 'FAILURE'; result.error = error.stack; }
  finally {
    cleaning = true; cleanupDeadline = performance.now() + 40000; clearTimeout(outer);
    // Drain pending STOP and request before scope inspection; no republish or command retry.
    await Promise.allSettled([freezePromise, postmanPromise].filter(Boolean));
    const cleanupTimer = setTimeout(() => { for (const c of children) c.kill('SIGKILL'); }, 40000);
    try {
      if (original.length && (stopIntent || peerIntent)) {
        const ss = await scope();
        for (const [container, intended, stopped] of [[target, stopIntent, true], [peer, peerIntent, false]]) {
          if (!container || !intended) continue;
          const s = ss.find(s => s.Id === container.Id);
          const action = cleanupAction(s, container.Id, project, stopped);
          if (action) { intent('CLEANUP', { action, id: container.Id }); await docker(...(action === 'continue' ? ['kill', '--signal', 'SIGCONT', container.Id] : ['start', container.Id])); }
          result.cleanup.push({ id: container.Id, action });
        }
        const restored = await waitFor('cleanup restoration', 15000, async () => {
          const ss = await scope(); const q = await get(); const health = await get('/health');
          return healthy(ss) && queueIs(q, 0, 0, 0, 2) && health.status === 'ready' ? { containers: ss, queue: q, health } : null;
        }); save('cleanup-final.json', restored);
      }
      if (trialUTC) for (const s of original.filter(s => ['orders-api', 'notification-worker'].includes(s.Config.Labels['com.docker.compose.service']))) save(`final-logs-${s.Id.slice(0, 12)}.txt`, await logs(s.Id));
    } catch (error) { result.cleanupError = error.stack; result.state = 'FAILURE'; }
    finally {
      clearTimeout(cleanupTimer);
      for (const c of children) c.kill('SIGKILL');
      if (watcher) await Promise.allSettled([watcher]);
      process.off('SIGINT', onINT); process.off('SIGTERM', onTERM);
      if (fatal || cancelled) { result.state = 'FAILURE'; result.error ??= fatal?.stack ?? 'cancelled'; }
      result.finished = new Date().toISOString(); save('recovery.json', result);
      save('MANUAL_RECOVERY.txt', `Only if orchestrator was SIGKILLed or cleanup failed: verify original IDs and project labels first.\nTarget: ${target?.Id ?? 'unresolved'}\nPeer: ${peer?.Id ?? 'unresolved'}\nIf original target running but frozen: docker kill --signal SIGCONT TARGET.\nIf original worker exited: docker start ORIGINAL_ID. Never start replacement or republish.\nVerify two running workers, Consumers=2 and queue=0/0/0; preserve failed attempt.\n`);
    }
  }
  console.log(JSON.stringify(result, null, 2));
  if (result.state !== 'TECHNICALLY_VERIFIED_VISUAL_PENDING') process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!executionAllowed(process.argv.slice(2))) {
    console.error('Refusing runtime: explicit --execute-ack-recovery required. No services touched.'); process.exitCode = 2;
  } else {
    run().catch(error => { console.error(error.stack); process.exitCode = 1; });
  }
}
