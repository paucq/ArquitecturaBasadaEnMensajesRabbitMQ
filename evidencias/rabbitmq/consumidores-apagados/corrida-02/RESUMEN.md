# Corrida 02 — pedido publicado, escenario de captura fallido

Se verificaron dos workers running, API y broker healthy. Se detuvieron únicamente ambos workers (Compose: exited). Una espera finita de máximo 30 segundos, dentro del mismo comando de orquestación, consultó Management conservando cada lectura y sus timestamps en `05-baseline-N-*`. Finalmente `consumers=0`, `consumer_details=[]`, Ready=0, Unacked=0, Total=0: `baseline.json` contiene el JSON completo.

Se ejecutó exactamente un request mediante Postman CLI, exitcode **0**, 1 request, 4 aserciones aprobadas, HTTP **202 Accepted**, 94 ms. No hubo timeout ni repetición de publicación. Request y respuesta originales: `06-postman-stdout.txt`; stderr separado; comando, inicio/fin y exitcode en archivos del mismo prefijo. Se usaron `-i 'Crear pedido — esperado HTTP 202'`, `--no-report-events --verbose --timeout 30000 --timeout-request 10000 --timeout-script 5000`; sin output/login. Body: Pedro / Libro de arquitectura / quantity 1.

**ID real:** `ORD-4cc41fe7-7675-4929-a274-74f02a7b3a1e`.
Respuesta: `{"status":"accepted","message":"Pedido recibido y enviado a RabbitMQ","orderId":"ORD-4cc41fe7-7675-4929-a274-74f02a7b3a1e"}`.

## Fallo de instrumentación y restauración

A las **2026-10-27T01:32:41.640537+00:00** el extractor de ID falló: buscaba un UUID contiguo en stdout, pero Postman lo había partido visualmente entre líneas. La orquestación terminó **1** por `AssertionError('ID no inequívoco')`. **No fue fallo de publicación ni de API.** Se activó incorrectamente la vía de restauración antes de reconstruir el texto multilínea, arrancando ambos workers. El ID se recuperó después uniendo únicamente líneas del bloque verbose, sin enviar más pedidos.

Por esa restauración el pedido ya fue consumido. Logs originales `10-logs-diagnostico-stdout.txt` y selección `logs-mismo-id.txt`:
- order_published: 2026-10-27T01:32:40.690Z.
- order_received: 2026-10-27T01:32:43.276Z, worker-2.
- order_processed: 2026-10-27T01:32:46.288Z, worker-2.

No se alcanzó la espera posterior Ready=baseline+1 con workers apagados; no existe JSON que demuestre ese estado. `11-cola-restaurada-stdout.txt` conserva JSON completo posterior: durable=true, Consumers=2, Ready=0, Unacked=0, Total=0. `12-verificacion-final-stdout.txt`: ambos workers **running**, API y broker **healthy**.

Todos los comandos externos ejecutados terminaron **0**, incluidos stop, Postman, restauración start, consultas de cola/logs y ps; cada uno conserva comando, stdout/stderr, exitcode y timestamps reales. La validación de orquestación terminó 1, no ocultar esa distinción.

## Pendientes

No quedó escenario verificable para screenshot; **no se tomó ni reutilizó captura GUI**. No se publicó un segundo pedido. No se completan CP formales ni se demuestra ausencia de pérdida/elasticidad. Anexo 1 apartado 9: publicación local documentada; captura pendiente.

Para la futura captura debe existir Queue `pedidos` en http://localhost:15672 con Ready>=1, Unacked=0, Consumers=0 y ambos workers apagados. Tras esa captura, el comando futuro desde `rabbitmq/` es `docker compose -p qa-taller-integracion-rabbitmq start notification-worker`; en esta corrida ya se ejecutó como restauración fallida del objetivo, no como continuación autorizada tras screenshot. El consumo posterior de este ID sí está registrado, pero ocurrió antes de la captura y no sustituye el procedimiento pendiente.

RED: not active — strict TDD was not activated.
GREEN: not active — validation is reported separately.
