### CP-08 — Message-driven — RabbitMQ

- ID del caso: CP-08.
- Arquitectura: RabbitMQ.
- Objetivo: comprobar comunicación API–worker mediada por el broker, sin llamadas directas entre esos servicios en la implementación inspeccionada (guía del taller p. 4 y Anexo 1 pp. 7–13).
- Precondiciones: implementación existente Node.js/Express/amqplib; API, broker y workers independientes. Se reutiliza únicamente trazabilidad/corrida-01 de CP-06, ejecutada el 2026-10-27. Diagnóstico temporal ya desactivado y dos workers restaurados según [verificación](../trazabilidad/corrida-01/cleanup-verification.json) y [estado conservado](../trazabilidad/corrida-01/resume-final-state.json); no se consulta ni altera el runtime aquí.
- Datos de entrada: pedido original `{"customerName":"Pedro","product":"Libro de arquitectura","quantity":1}`; mensaje `ProcessOrder`, createdAt `2026-10-27T02:42:34.616Z`. Único orderId/correlationId/messageId: `ORD-8d488fb8-62c9-4e37-935d-31aed2a8aa9e`.
- Pasos ejecutados:
  1. Leer completos api.mjs, broker.mjs, worker.mjs, docker-compose.yml y package.json; examinar publicación, conexión y consumo, no solo nombres.
  2. Contrastar configuración y fragmentos exactos de abajo: ambos procesos conectan por AMQP a RabbitMQ; el productor publica en la cola que consume el worker.
  3. Revisar el [JSONL nativo original](../trazabilidad/corrida-01/broker-native-original.jsonl), decodificar sus dos payloads base64 y contrastar IDs con los logs originales de [API](../trazabilidad/corrida-01/logs-orders-api-same-id.txt) y [worker](../trazabilidad/corrida-01/logs-notification-worker-same-id.txt).
  4. Revisar la captura real existente de la vista derivada, sin producir otra solicitud, captura sintética ni reactivar tracing.
- Resultado esperado: código/configuración con publicación y suscripción AMQP, más evidencia nativa del broker que relaciona publicación y entrega del mismo pedido al consumidor; sin invocación HTTP API–worker en este flujo.
- Resultado obtenido: broker `published` a `2026-10-27T02:42:35.087+00:00`, exchange `""` (predeterminado), routing_keys y routed_queues `["pedidos"]`; broker `received` a `02:42:35.103+00:00`, queue `pedidos`. En ambos registros correlation_id y message_id coinciden con payload.orderId. API registra order_published `02:42:35.123Z`; worker-1 / `9daaf02d21e3` registra order_received `02:42:35.158Z` y order_processed `02:42:38.411Z`. Son marcas UTC de fuentes distintas: el log API ocurre tras la confirmación, no antes de publicar en el broker. La mediación observada se acredita por la traza nativa, no por la mera coexistencia de logs o contenedores.
- Evidencia (capturas): [captura real aportada por el usuario](../trazabilidad/corrida-01/captura-trazabilidad-api-broker-worker.png), revisada completa: API, BROKER NATIVO y WORKER-1 del mismo ID. Está titulada CP-06 y VISTA DERIVADA DE REGISTROS REALES; se reutiliza por pertinencia al flujo CP-08. No es GUI de RabbitMQ ni JSONL nativo modificado. [Vista textual conservada](../trazabilidad/corrida-01/VISTA_EVIDENCIAS.txt). Fragmentos verificables y fuentes enlazadas abajo complementan la captura.
- Estado: Cumple.
- Análisis técnico: conclusión propia, no calificación del profesor. En el código inspeccionado la API importa broker.mjs y envía el mensaje mediante sendToQueue; el worker importa el mismo módulo de conexión y consume pedidos por AMQP. No existe llamada directa API–worker en ese flujo: el worker no expone servidor HTTP y la API no lo invoca. El fetch del healthcheck Compose consulta la propia API en localhost, no al worker. Docker por sí solo no demuestra esta propiedad. La cola compartida representa consumidores competidores, no broadcast ni tópico Kafka. `received` nativo significa entrega desde el broker, no ack; el código acredita ack manual tras la demora simulada, sin afirmar una traza de ack por ID. Durabilidad/persistencia y confirmación del productor no prueban exactly-once, recuperación CP-12 ni resiliencia CP-09. La muestra es un pedido; HTTP 202/1655 ms y 4/4 aserciones de la corrida original son contexto complementario, no benchmark CP-07. No se mezclan corrida b7a ni lote CP-10.

#### Código/configuración inspeccionados — fragmentos literales

[api.mjs](../../../rabbitmq/api.mjs), líneas 5–9: canal de confirmación y cola durable.

```js
const connection = await connect();
const channel = await connection.createConfirmChannel();
channel.on('error', error => log('channel_error', { error: error.message }));
channel.on('close', () => process.exit(1));
await channel.assertQueue(queue, { durable: true });
```

[api.mjs](../../../rabbitmq/api.mjs), líneas 26–30: publicación persistente correlacionada; callback confirma el broker, no el procesamiento del worker.

```js
    await new Promise((resolve, reject) => channel.sendToQueue(
      queue, Buffer.from(JSON.stringify(message)),
      { persistent: true, contentType: 'application/json', messageId: orderId, correlationId: orderId },
      error => error ? reject(error) : resolve(),
    ));
```

[broker.mjs](../../../rabbitmq/broker.mjs), líneas 1–3 y 14 respectivamente: cliente y nombre de cola constantes; variable real `AMQP_URL`, no `RABBITMQ_URL` ni `RABBITMQ_QUEUE`.

```js
import amqp from 'amqplib';

export const queue = 'pedidos';
```

```js
      const connection = await amqp.connect(process.env.AMQP_URL);
```

[worker.mjs](../../../rabbitmq/worker.mjs), líneas 9–11, 17–21 y 27 respectivamente: consumo de la misma cola, prefetch 1 y ack manual después de la simulación.

```js
await channel.assertQueue(queue, { durable: true });
await channel.prefetch(1);
await channel.consume(queue, async message => {
```

```js
    log('order_received', trace);
    await new Promise(resolve => setTimeout(resolve, delay));
    // Notificación simulada. El ack se envía solo al terminar, no al recibir.
    channel.ack(message);
    log('order_processed', trace);
```

```js
}, { noAck: false });
```

[docker-compose.yml](../../../rabbitmq/docker-compose.yml), líneas 20–25 y 43–51: procesos separados. Ambos `AMQP_URL` señalan al servicio `rabbitmq:5672`; se omiten aquí valores de conexión locales, consultables en la fuente original. Dos réplicas de worker configuradas. [package.json](../../../rabbitmq/package.json) declara Express y amqplib; no constituye por sí mismo prueba runtime. La revisión de estos archivos no los modifica.

#### Validación y límites de esta unidad

Revisión documental pasiva, sin TDD de aplicación ni nuevos tests/scripts de producción. [Resumen y comprobación offline](RESUMEN.md). Los originales y CP-07 se preservan; no se ejecutan Docker, Postman, curl, reinicios, instalaciones ni peticiones nuevas. El estado de servicios citado es histórico, no una verificación live actual.
