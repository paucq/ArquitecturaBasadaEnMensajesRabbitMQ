# Corrida 03 — captura recibida y consumo posterior verificado

## Cierre documental — CP-11 RabbitMQ

[Reporte formal CP-11 de 11 campos: Cumple](reporteCP11.md), sustentado en las evidencias existentes antes/después y logs del mismo ID. Es una conclusión del reporte, no calificación del profesor. No cierra otros CP ni Kafka. Este cierre no ejecutó operaciones live ni modificó los archivos de evidencia originales. Las afirmaciones posteriores sobre falta de reporte describen el estado histórico previo a este cierre.

## Continuación autorizada — estado actual

La [captura aportada por el usuario](management-pedido-pendiente.png) quedó guardada antes de reactivar: Ready=1, Unacked=0, Total=1, Consumers=0, Persistent=1 y durable=true (lectura de la captura comunicada por el padre). El usuario aportó después la [captura final de Management](consumo-posterior/management-pedido-consumido.png): Ready=0, Unacked=0, Total=0, Consumers=2 y durable=true. Ambas imágenes son capturas reales; la segunda muestra el estado posterior, mientras que los logs relacionan el consumo con el mismo pedido.

Precondiciones live confirmadas el **2026-10-27T01:46:28 UTC**: ambos workers exited; Management Ready=1, Unacked=0, Total=1, Consumers=0, durable=true. Se ejecutó una sola vez `docker compose -p qa-taller-integracion-rabbitmq start notification-worker`, sin publicar otro pedido. Una única espera automática acotada a 45 s verificó recepción/procesamiento del mismo ID y estadísticas finales; no hubo timeout ni repetición de start.

**ID:** `ORD-b7a74952-2957-49cb-a5db-f88d7b2ce443`. Timestamps de aplicación, todos UTC del **2026-10-27**:

| Evento | UTC | Instancia |
| --- | --- | --- |
| order_published (publicación previa) | 01:39:39.627Z | orders-api |
| order_received | 01:46:31.200Z | notification-worker-2 / aea9d0d7aa00 |
| order_processed | 01:46:34.229Z | notification-worker-2 / aea9d0d7aa00 |

Recepción 411.573 s después de la publicación; procesamiento 3.029 s después de recepción. No confundir los timestamps de aplicación con el prefijo Docker de los logs. `redelivered=false` es lo registrado, no una garantía exactly-once.

**Estado final verificado a 2026-10-27T01:46:40.985636+00:00:** ambos workers running, API y broker running/healthy; Consumers=2, Ready=0, Unacked=0, Total=0, durable=true. [Resultado final nuevo](consumo-posterior/resultado-final.json), [Management completo](consumo-posterior/management-final.json), [Compose final](consumo-posterior/07-final-compose-stdout.txt), [logs correlacionados del worker](consumo-posterior/logs-mismo-id-notification-worker.txt).

Evidencia íntegra en `consumo-posterior/`: prefijos `01-pre-compose`, `02-pre-management`, `03-start`, `04-espera-45s`, `05-logs-orders-api`, `05-logs-rabbitmq`, `05-logs-notification-worker`, `06-final-management`, `07-final-compose`, cada uno con comando literal, inicio/fin UTC, stdout, stderr y exitcode **0**. [Orquestación exacta](consumo-posterior/operacion.py); ejecución única `python3 evidencias/rabbitmq/consumidores-apagados/corrida-03/consumo-posterior/operacion.py` desde el taller, exitcode 0. Los logs originales de los tres servicios y filtros por ID están guardados separados; el filtro del broker vacío no implica que este registre IDs de aplicación.

La captura previa y el consumo posterior aportan evidencia de desacoplamiento temporal/CP-11 y consumo/trazabilidad; **ningún CP formal completo sin sus 11 campos**. No demuestra CP-12, elasticidad, ausencia general de pérdida ni exactly-once. Captura final Management recibida y enlazada arriba (0/0/0, Consumers=2); queda documentada la pareja visual antes/después. No se ejecutó Postman, otro publicador, Get messages, purge ni intervención sobre volúmenes. No se cambiaron aplicación, Compose ni colección.

El resto del documento es el **registro histórico anterior a esta continuación**: sus expresiones «pendiente» y «no se ejecutó start» describen exclusivamente ese momento. [resultado.json](resultado.json) permanece intacto como estado anterior.

## Resultado verificado

**ID:** `ORD-b7a74952-2957-49cb-a5db-f88d7b2ce443`.

Se publicó exactamente un pedido adicional mediante Postman CLI: **HTTP 202 Accepted, 27 ms, 1 request, 4/4 aserciones, exitcode 0**. El parser reutilizable corregido terminó 0. Sin segunda publicación, quantity cero, login ni `--output`. Los avisos de credenciales del CLI se conservan en stdout; no impidieron ejecutar localmente.

[Resultado estructurado](resultado.json), verificado a **2026-10-27T01:39:45.394411+00:00**:

| Propiedad | Baseline tras detener | Después de publicar |
| --- | --- | --- |
| durable | true | true |
| Consumers | 0 | 0 |
| Ready | 0 | 1 |
| Unacked | 0 | 0 |
| Total | 0 | 1 |

JSON completos: [baseline](baseline.json), [cola final](cola-final.json). `consumer_details=[]` en ambos. Las esperas de estadísticas fueron finitas (máximo 30 segundos cada una), ejecutadas dentro de un único comando de orquestación, sin polling de jobs. Cada lectura original se preservó en `05-baseline-N-*` y `08-final-N-*` con comando, inicio/fin, stdout/stderr y exitcode.

**Estado final:** ambos workers `exited`; API y broker `running`, `healthy`. [Compose final original](10-final-stdout.txt). No se ejecutó start/restauración. No se consumió ni purgó el mensaje; no se llamó get-message.

## Comandos, request y respuesta

Directorio de ejecución: `rabbitmq/` del taller. Cada prefijo cuenta con archivos `-comando.txt`, `-inicio.txt`, `-fin.txt`, `-stdout.txt`, `-stderr.txt`, `-exitcode.txt`. **Todos los comandos ejecutados terminaron 0**, y la orquestación terminó 0.

- `01-antes`: `docker compose -p qa-taller-integracion-rabbitmq ps -a --format json`; dos workers running, API/broker healthy.
- `02-health`: GET `http://localhost:3000/health` con curl fail/max-time 5.
- `03-stop`: `docker compose -p qa-taller-integracion-rabbitmq stop notification-worker`.
- `04-parados`: ps confirmó exactamente dos workers exited antes de publicar.
- `05-baseline-N`: GET Management `/api/queues/%2F/pedidos`, hasta Consumers=0 y Unacked=0; baseline Ready=0.
- [Comando Postman literal](06-postman-comando.txt): `postman collection run pruebas/RabbitMQ.postman_collection.json -i 'Crear pedido — esperado HTTP 202' --no-report-events --verbose --timeout 30000 --timeout-request 10000 --timeout-script 5000`.
- [stdout original request/response](06-postman-stdout.txt), [stderr](06-postman-stderr.txt), [exitcode](06-postman-exitcode.txt), [inicio](06-postman-inicio.txt), [fin](06-postman-fin.txt).
- [Parser probado, comando literal](07-parser-comando.txt) y [ID extraído](07-parser-stdout.txt): Node ejecutó `herramientas/extract-order-id.mjs` sobre el stdout guardado; sin nueva llamada HTTP.
- `08-final-N`: GET Management hasta Ready=baseline+1, Unacked=0, Consumers=0.
- [Comando logs API](09-api-logs-comando.txt), [logs originales](09-api-logs-stdout.txt), [mismo ID](logs-mismo-id.txt).
- `10-final`: ps confirma ambos workers exited y API/broker healthy.

Request original: POST `http://localhost:3000/orders`, Content-Type application/json; body Pedro / Libro de arquitectura / quantity 1, preservado íntegro en stdout.

Respuesta JSON reconstruida únicamente para lectura (original intacto en stdout):

```json
{"status":"accepted","message":"Pedido recibido y enviado a RabbitMQ","orderId":"ORD-b7a74952-2957-49cb-a5db-f88d7b2ce443"}
```

`order_published`: **2026-10-27T01:39:39.627Z**, mismo orderId/correlationId, cola pedidos. No se afirma recepción ni procesamiento: **workers apagados**. El incremento del contador y el log aportan correlación temporal, no inspección del payload en broker.

## Captura e instrucciones de continuación

**No se tomó captura GUI.** Abrir `http://localhost:15672` (admin/admin del laboratorio), Queues → `pedidos`; mostrar Ready **1**, Unacked **0**, Consumers **0** y Total **1**. No pulsar Get messages ni Purge. No reutilizar screenshots de otras corridas.

**Dejar ambos workers apagados hasta que el usuario aporte la captura.** Solo después, con continuación autorizada desde `rabbitmq/`, ejecutar:

```sh
docker compose -p qa-taller-integracion-rabbitmq start notification-worker
```

Ese comando **no se ejecutó en corrida 03**. Pendiente confirmar consumo posterior mediante el mismo ID y actualización de cola, sin publicar otro pedido.

## Cobertura y límites

Anexo 1 apartado 9: request válido Postman, respuesta y publicación verificadas; almacenamiento con consumidores ausentes observado por Management. Aporta evidencia parcial para CP-01/02/09/11, pero **ningún CP formal completo** sin reporte de 11 campos y capturas. Consumo posterior pendiente; no demuestra ausencia de pérdida, recuperación ni elasticidad.

RED: not active — strict TDD was not activated para esta ejecución.
GREEN: not active — validación operativa reportada separadamente; el arreglo del parser ya tiene evidencia TDD offline en herramientas.
