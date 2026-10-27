import amqp from 'amqplib';

export const queue = 'pedidos';
export function log(event, details = {}) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(), service: process.env.SERVICE_NAME,
    instance: process.env.HOSTNAME, event, ...details,
  }));
}

export async function connect() {
  for (let attempt = 1; attempt <= 30; attempt++) {
    try {
      const connection = await amqp.connect(process.env.AMQP_URL);
      connection.on('error', error => log('broker_error', { error: error.message }));
      // Salir permite que Compose reinicie el servicio y restablezca canales/suscripciones.
      connection.on('close', () => process.exit(1));
      return connection;
    } catch (error) {
      log('connection_retry', { attempt, error: error.message });
      if (attempt === 30) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}
