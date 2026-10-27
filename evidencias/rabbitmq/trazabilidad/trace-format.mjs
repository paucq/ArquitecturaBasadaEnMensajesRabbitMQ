// Native JSON Lines schema: rabbitmq-server v4.4.0 rabbit_tracing_consumer.erl.
export function decodeTrace(raw) {
  return raw.split(/\r?\n/).filter(line => line.trim()).map(line => {
    try {
      const record = JSON.parse(line);
      if (!['published', 'received'].includes(record.type)) throw new Error('Unknown native type');
      if (typeof record.payload !== 'string') throw new Error('Missing base64 payload');
      const payloadText = Buffer.from(record.payload, 'base64').toString('utf8');
      return { native: record, decodedPayload: JSON.parse(payloadText) };
    } catch (cause) {
      throw new Error('Invalid native trace JSON or payload', { cause });
    }
  });
}
export function matchingEvents(raw, id) {
  return decodeTrace(raw).filter(({ native, decodedPayload }) =>
    decodedPayload.orderId === id && native.properties?.correlation_id === id
    && native.properties?.message_id === id);
}
export function completeTrace(events) {
  return events.some(({ native }) => native.type === 'published' && native.routed_queues.includes('pedidos'))
    && events.some(({ native }) => native.type === 'received' && native.queue === 'pedidos');
}
