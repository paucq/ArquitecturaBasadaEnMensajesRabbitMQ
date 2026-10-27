# Cómo funciona el flujo RabbitMQ

**La API espera al broker, no al worker.** El cliente recibe aceptación HTTP antes de que termine la notificación simulada.

```text
Cliente --POST /orders--> orders-api (Express)
                              |
                         AMQP confirm
                              v
                     RabbitMQ: pedidos
                         /         \
                    worker 1     worker 2
                    ack manual al terminar
```

## Decisiones observables en el código

| Pieza | Comportamiento y límite |
|---|---|
| API | Valida `customerName`, `product` y `quantity` entera positiva. Publica `ProcessOrder` con UUID, `createdAt`, `messageId` y `correlationId`. Responde 202 tras confirm del broker; 400 ante datos inválidos y 503 si falla la confirmación. |
| Broker | Cola durable `pedidos` y mensajes persistentes; volumen `rabbitmq-data`. La API/worker reciben `AMQP_URL`. No se configura la cola mediante una variable de entorno. |
| Workers | Dos réplicas del mismo servicio, `prefetch(1)` y `noAck: false`; cada una espera `PROCESSING_DELAY_MS=3000` y confirma al terminar. No exponen HTTP ni reciben llamadas directas desde la API. |
| Recuperación | El cierre AMQP termina el proceso; Compose lo reinicia con reintentos de conexión. Sin ack puede haber reentrega. No hay deduplicación de efectos: **no se garantiza exactamente una vez**. |
| Trazabilidad | `orderId` y `correlationId` unen publicación, recepción y procesamiento; los logs añaden instancia y timestamp. |

Hay tres servicios Compose, pero **cuatro contenedores**: API, broker y dos workers. La concurrencia permite repartir carga; no garantiza igualdad exacta de reparto ni orden global. Una respuesta HTTP rápida tampoco demuestra por sí sola todas las propiedades de un sistema reactivo.

## Diez casos: consultar evidencia, no confundir con smoke tests

Los siguientes son reportes existentes, no diez pruebas recién ejecutadas en Windows. Cada reporte contiene resultados, limitaciones y enlaces a su evidencia. Mantener toda la carpeta `evidencias/rabbitmq` sin reorganizar sus archivos para conservar esos enlaces internos.

| Caso | Reporte |
|---|---|
| CP-01 | [Creación de pedido](../evidencias/rabbitmq/casos-funcionales/reporteCP01.md) |
| CP-02 | [CP-02](../evidencias/rabbitmq/casos-funcionales/reporteCP02.md) |
| CP-03 | [CP-03](../evidencias/rabbitmq/casos-funcionales/reporteCP03.md) |
| CP-06 | [CP-06](../evidencias/rabbitmq/casos-funcionales/reporteCP06.md) |
| CP-07 | [Responsive](../evidencias/rabbitmq/responsive/reporteCP07.md) |
| CP-08 | [Message-driven](../evidencias/rabbitmq/message-driven/reporteCP08.md) |
| CP-09 | [Resilient](../evidencias/rabbitmq/resilient/reporteCP09.md) |
| CP-10 | [Reparto de carga](../evidencias/rabbitmq/reparto-carga/reporteCP10.md) |
| CP-11 | [Consumidores apagados, corrida 03](../evidencias/rabbitmq/consumidores-apagados/corrida-03/reporteCP11.md) |
| CP-12 | [Recuperación](../evidencias/rabbitmq/recuperacion/reporteCP12.md) |

Una captura renderizada a partir de un log se debe rotular como derivada; una captura histórica WSL no acredita Hyper-V. No reemplazar fallos ni corridas anteriores por una salida nueva. El informe final y la auditoría se organizan en [docs/entrega](entrega/); esta página es un mapa conceptual, no un reemplazo del informe completo.

## Fuentes y alcance

- Material del curso: guía del taller, sección RabbitMQ, **páginas 7–13** (fuente principal del escenario y sus casos; consultar copia del material en las fuentes de entrega).
- Implementación inspeccionada: [api.mjs](../rabbitmq/api.mjs), [broker.mjs](../rabbitmq/broker.mjs), [worker.mjs](../rabbitmq/worker.mjs), [Compose](../rabbitmq/docker-compose.yml) y [runner](../rabbitmq/pruebas/flujo.test.mjs). Los códigos HTTP, UUID y políticas concretas son decisiones de esta implementación, no requisitos inventados de la guía.
- [RabbitMQ: confirms y acknowledgements](https://www.rabbitmq.com/docs/confirms): confirmación de publicación y confirmación de consumo son mecanismos distintos.
- [Docker Desktop en Windows](https://docs.docker.com/desktop/setup/install/windows-install/): requisitos de Hyper-V y plataformas admitidas. No constituye evidencia de ejecución de este laboratorio.
