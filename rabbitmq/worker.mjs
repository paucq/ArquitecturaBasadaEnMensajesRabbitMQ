import { connect, log, queue } from './broker.mjs';

const delay = Number(process.env.PROCESSING_DELAY_MS ?? 3000);
if (!Number.isFinite(delay) || delay < 0) throw new Error('PROCESSING_DELAY_MS inválido');
const connection = await connect();
const channel = await connection.createChannel();
channel.on('error', error => log('channel_error', { error: error.message }));
channel.on('close', () => process.exit(1));
await channel.assertQueue(queue, { durable: true });
await channel.prefetch(1);
await channel.consume(queue, async message => {
  if (!message) return;
  try {
    const data = JSON.parse(message.content.toString());
    const trace = { orderId: data.orderId, correlationId: message.properties.correlationId,
      redelivered: message.fields.redelivered };
    log('order_received', trace);
    await new Promise(resolve => setTimeout(resolve, delay));
    // Notificación simulada. El ack se envía solo al terminar, no al recibir.
    channel.ack(message);
    log('order_processed', trace);
  } catch (error) {
    log('processing_failed', { error: error.message });
    // No confirmar: al reiniciar se reentrega el mensaje pendiente.
    process.exit(1);
  }
}, { noAck: false });
log('worker_ready', { queue, processingDelayMs: delay });
