import { randomUUID } from 'node:crypto';
import express from 'express';
import { connect, log, queue } from './broker.mjs';

const connection = await connect();
const channel = await connection.createConfirmChannel();
channel.on('error', error => log('channel_error', { error: error.message }));
channel.on('close', () => process.exit(1));
await channel.assertQueue(queue, { durable: true });

const app = express();
app.use(express.json({ limit: '16kb' }));
app.get('/health', (_request, response) => response.json({ status: 'ready' }));
app.post('/orders', async (request, response) => {
  const { customerName, product, quantity } = request.body ?? {};
  if (typeof customerName !== 'string' || !customerName.trim()
      || typeof product !== 'string' || !product.trim()
      || !Number.isSafeInteger(quantity) || quantity < 1) {
    return response.status(400).json({ error: 'Se requieren customerName, product y quantity entera positiva' });
  }
  const orderId = `ORD-${randomUUID()}`;
  const message = { type: 'ProcessOrder', orderId, customerName, product, quantity,
    createdAt: new Date().toISOString() };
  try {
    // Espera confirmación del broker, nunca el procesamiento del worker.
    await new Promise((resolve, reject) => channel.sendToQueue(
      queue, Buffer.from(JSON.stringify(message)),
      { persistent: true, contentType: 'application/json', messageId: orderId, correlationId: orderId },
      error => error ? reject(error) : resolve(),
    ));
    log('order_published', { orderId, correlationId: orderId, queue });
    return response.status(202).json({ status: 'accepted',
      message: 'Pedido recibido y enviado a RabbitMQ', orderId });
  } catch (error) {
    log('publish_failed', { orderId, error: error.message });
    return response.status(503).json({ error: 'No se pudo confirmar publicación en RabbitMQ', orderId });
  }
});
app.use((error, _request, response, _next) => {
  log('request_error', { error: error.message });
  response.status(error.status === 400 ? 400 : 500).json({ error: 'Solicitud no procesada' });
});
app.listen(3000, '0.0.0.0', () => log('api_ready', { port: 3000 }));
