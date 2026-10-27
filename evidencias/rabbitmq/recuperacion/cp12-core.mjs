import { StringDecoder } from 'node:string_decoder';
const uuid = /^ORD-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function requireThat(ok, message) { if (!ok) throw new Error(message); }
export function executionAllowed(args) { return args.length === 1 && args[0] === '--execute-ack-recovery'; }
export function postmanCommand(collection) {
  return ['postman', 'collection', 'run', collection, '-i', 'Crear pedido — esperado HTTP 202', '--no-report-events', '--verbose', '--timeout', '30000', '--timeout-request', '10000', '--timeout-script', '5000'];
}
export function queueIs(q, ready, unacked, total, consumers) {
  return q.durable === true && q.messages_ready === ready && q.messages_unacknowledged === unacked && q.messages === total && q.consumers === consumers;
}
/** Docker timestamp prefix is preserved in raw output, removed only for JSON parsing. */
export class Decoder {
  constructor(consume) { this.consume = consume; this.decoder = new StringDecoder('utf8'); this.buffer = ''; }
  push(chunk) {
    this.buffer += this.decoder.write(chunk);
    requireThat(this.buffer.length < 1048576, 'log line exceeds limit');
    let i;
    while ((i = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, i).trim(); this.buffer = this.buffer.slice(i + 1);
      if (line) {
        let value;
        try { value = JSON.parse(line.replace(/^\d{4}-\S+\s+/, '')); }
        catch (cause) { throw new Error('invalid JSON log', { cause }); }
        this.consume(value);
      }
    }
  }
  end() { this.buffer += this.decoder.end(); requireThat(!this.buffer.trim(), 'incomplete log at EOF'); }
}
export class Machine {
  constructor(since, instance) { this.since = Date.parse(since); this.instance = instance; this.processed = new Set(); this.published = false; this.recovered = false; }
  publish() { requireThat(!this.published, 'publish only once'); this.published = true; }
  fresh(e) { return Number.isFinite(Date.parse(e.timestamp)) && Date.parse(e.timestamp) >= this.since; }
  event(e) {
    if (!this.fresh(e) || e.instance !== this.instance) return false;
    if (e.event === 'order_processed') this.processed.add(e.orderId);
    if (e.event !== 'order_received') return false;
    requireThat(this.published && uuid.test(e.orderId) && e.correlationId === e.orderId && e.redelivered === false, 'invalid initial receive');
    requireThat(!this.id || this.id === e.orderId, 'multiple order IDs');
    requireThat(!this.processed.has(e.orderId), 'already processed');
    if (this.id) return false;
    this.id = e.orderId; return true;
  }
  stop(now) { requireThat(this.id && this.stoppedAt === undefined, 'STOP requires fresh receive once'); this.stoppedAt = now; }
  http(id) { requireThat(this.id === id, 'HTTP ID mismatch'); this.httpId = id; }
  publication(e) { if (this.fresh(e) && e.event === 'order_published' && e.orderId === this.id && e.correlationId === this.id) this.apiPublished = true; }
  gate(q, now) {
    requireThat(this.stoppedAt !== undefined && now - this.stoppedAt < 12000, 'STOP deadline');
    requireThat(!this.processed.has(this.id), 'already processed');
    requireThat(this.httpId === this.id && !!this.id, 'HTTP missing');
    requireThat(this.apiPublished, 'API publication missing');
    requireThat(queueIs(q, 0, 1, 1, 1), 'queue gate'); this.gated = true;
  }
  fault() { requireThat(this.gated, 'fault requires gate'); this.faulted = true; }
  eof() { requireThat(this.faulted, 'unexpected watcher EOF'); }
  recovery(e) {
    if (!this.faulted || !this.fresh(e) || e.instance !== this.instance || e.orderId !== this.id || e.correlationId !== this.id || e.redelivered !== true) return;
    if (e.event === 'order_received') this.redeliveryAt = Date.parse(e.timestamp);
    if (e.event === 'order_processed' && this.redeliveryAt !== undefined && Date.parse(e.timestamp) >= this.redeliveryAt) this.recovered = true;
  }
}
/** Refuse replacement/foreign containers; caller must resolve original name before inspect. */
export function cleanupAction(s, id, project, stopIntent) {
  requireThat(s.Id === id && s.Config.Labels['com.docker.compose.project'] === project && !s.State.Paused, 'cleanup scope changed');
  if (s.State.Running) return stopIntent ? 'continue' : null;
  requireThat(s.State.Status === 'exited', 'unexpected container state');
  return 'start';
}
