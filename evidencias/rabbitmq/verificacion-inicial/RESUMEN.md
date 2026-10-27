# Verificación inicial RabbitMQ

## Resultado y alcance

Smoke inicial verificado: **2/2 tests, 0 fallos**, job7 exit 0 según registro del ejecutor. Entorno actual: **cuatro contenedores**, tres tipos de servicio (API, broker y **dos workers independientes por defecto**). No equivale a completar CP-10 ni los diez reportes RabbitMQ.

- [GREEN actual: job7](GREEN-dos-workers.txt): arranque con dos réplicas y `npm test`. La prueba publica con ambos workers apagados, verifica payload persistente y correlationId en cola y después procesa el mismo pedido; la segunda rechaza `quantity: 0` con HTTP 400. El detalle de esas aserciones procede del contexto de ejecución; el stdout conserva nombres y resultado agregado, no un volcado HTTP/payload.
- [GREEN anterior: job6](GREEN-anterior-un-worker.txt): 2/2 con una instancia; corrida separada, no usarla para justificar dos workers.
- [Build/arranque ya conservado](arranque-docker.txt): build exit 0 según registro del ejecutor; no se duplicó ni se repitió.
- [RED histórico](RED-api-no-implementada.txt): exit 1 por ECONNREFUSED; solo acredita API inaccesible en ese momento, **no un defecto funcional demostrado**.

## Consultas de evidencia (sin cambios de estado)

Desde `rabbitmq/`, con proyecto `qa-taller-integracion-rabbitmq` (en la captura se usó además `-f` con la ruta al Compose):

| Comando | Resultado conservado |
| --- | --- |
| `docker compose -p qa-taller-integracion-rabbitmq ps` | [Estado y puertos](compose-ps.txt): cuatro contenedores Up; API y broker healthy; workers Up, sin afirmar healthcheck propio. |
| `docker compose -p qa-taller-integracion-rabbitmq logs --no-color --timestamps rabbitmq orders-api notification-worker` | [Logs completos](compose-logs.txt), incluidos arranque y eventos de ambas instancias. |
| `docker --version`; `docker compose version`; `docker version --format '{{.Server.Version}}'` | [Versiones](versiones-imagenes.txt): Engine/CLI 29.6.2, Compose v5.3.1. |
| `docker image inspect rabbitmq:4-management qa-taller-integracion-rabbitmq-orders-api qa-taller-integracion-rabbitmq-notification-worker --format 'image={{join .RepoTags ","}} id={{.Id}} digests={{join .RepoDigests ","}}'` | [IDs y digests locales](versiones-imagenes.txt); no se consultó ni modificó un registro remoto. |

Los stdout/stderr de job6 y job7 se copiaron íntegros desde los logs del ejecutor; no se volvió a ejecutar `npm test`, build ni operaciones de ciclo de vida para esta documentación.

## Trazabilidad de la corrida actual

ID y correlationId coincidentes: **`ORD-4e22b930-342c-4c5e-8f5b-783bb12d64fb`**. En [compose-logs.txt](compose-logs.txt):

| Evento | Fecha UTC | Línea / instancia |
| --- | --- | --- |
| `order_published`, cola `pedidos` | 2026-10-27T01:01:25.165Z | 264 / API `28a4ac996bc2` |
| `order_received` | 2026-10-27T01:01:26.788Z | 2 / worker-2 `aea9d0d7aa00` |
| `order_processed` | 2026-10-27T01:01:29.792Z | 4 / mismo worker-2 |

Recepción y procesamiento registran `redelivered: true`: se conserva explícitamente; no afirmar entrega exactamente una vez ni recuperación formal probada. El ID anterior `ORD-d35934b2-2b5f-4b2d-a20e-64b05ff1640b` aparece publicado en línea 263; no se mezcla con el actual y no se reconstruye su consumo desde contenedores recreados. Un pedido procesado por worker-2 no demuestra reparto entre los dos workers.

## Acceso y pendientes

Management local: **http://localhost:15672**, usuario **admin**, contraseña **admin** exclusivamente para este laboratorio. `compose-ps.txt` muestra puertos ligados a 127.0.0.1: API 3000, AMQP 5672 y Management 15672. La publicación del puerto no sustituye una captura ni prueba visual de acceso a la UI.

Pendientes: capturas reales de Management, JSON y estados Ready/Unacked/Total; diez reportes formales RabbitMQ con la plantilla del plan, mediciones y experimentos específicos (reparto, recuperación, etc.). Kafka, sus diez reportes y el PDF siguen pendientes. Próximo paso: preparar los CP formales RabbitMQ y sus capturas, reutilizando esta evidencia solo donde corresponda.
