# Consumidores apagados — intentos y estado actual

## Estado actual — corrida 03: consumo posterior verificado

Captura del usuario [guardada con el pedido pendiente](corrida-03/management-pedido-pendiente.png): Ready=1, Unacked=0, Total=1, Consumers=0, Persistent=1, durable=true. Tras confirmar las precondiciones live, se reactivaron **ambos workers** una sola vez, sin publicar otro pedido. El ID `ORD-b7a74952-2957-49cb-a5db-f88d7b2ce443`, publicado a **2026-10-27T01:39:39.627Z**, fue recibido por **worker-2** a **01:46:31.200Z** y procesado a **01:46:34.229Z**, todos UTC del mismo día. Espera única acotada a 45 s: exitcode 0. A **01:46:40.985636 UTC**, ambos workers running y API/broker healthy; cola **Ready=0, Unacked=0, Total=0, Consumers=2**, durable=true.

[Continuación, comandos y límites](corrida-03/RESUMEN.md), [resultado final nuevo](corrida-03/consumo-posterior/resultado-final.json), [Management final](corrida-03/consumo-posterior/management-final.json), [logs del mismo ID](corrida-03/consumo-posterior/logs-mismo-id-notification-worker.txt). El resultado anterior permanece intacto. Captura final Management aún no aportada. Evidencia parcial para reportes, **ningún CP formal completo** sin 11 campos; no demuestra CP-12, elasticidad ni exactly-once.

## Registro histórico — corrida 03 antes de recibir la captura

Los pendientes y estados descritos a continuación son históricos; prevalece el estado actual anterior.

[Corrida 03: comandos, request/response y evidencia](corrida-03/RESUMEN.md). **Un único pedido adicional** publicado: `ORD-b7a74952-2957-49cb-a5db-f88d7b2ce443`; Postman exitcode 0, HTTP 202, 4/4 aserciones; parser corregido exitcode 0. Baseline Ready=0 → Ready=1, Unacked=0, Consumers=0, Total=1, durable=true. Verificación final 2026-10-27T01:39:45.394411+00:00: **ambos workers exited; API y broker healthy**. Se dejan apagados para captura del usuario; no se ejecutó start. Captura GUI y consumo posterior del mismo ID pendientes; ningún CP formal completo. Instrucciones y comando futuro start en el resumen enlazado. Los estados running descritos debajo son históricos de intentos previos, no el estado actual.

## Incidente tooling corregido offline

[Parser reutilizable, tests y descubrimiento](herramientas/RESUMEN.md). Se reconstruyen los bloques de respuesta HTTP antes de parsear JSON y validar su propiedad `orderId`; no se extrae desde tests. TDD observado sobre ambas fixtures originales: RED exitcode 1 (ambas fallan con extracción ingenua), GREEN exitcode 0 (7/7 tests, incluidos UUID partido y casos negativos). IDs verificados: `ORD-4cc41fe7-7675-4929-a274-74f02a7b3a1e` y `ORD-abf9d555-aa78-4f7f-8ff6-ae0a520a816a`. Ambos Postman originales fueron exitcode 0; no fue fallo de API. Esta corrección no ejecutó Docker/Postman ni publicó pedidos, no creó corrida live y no cambia los estados previamente documentados. Operaciones live en pausa; captura GUI pendiente.

## Actualización: corrida 02

[Corrida 02: evidencia íntegra y análisis](corrida-02/RESUMEN.md). La espera acotada sí alcanzó Consumers=0 y baseline Ready=0. Postman publicó **un único pedido**, HTTP 202, exitcode 0, 4/4 aserciones: `ORD-4cc41fe7-7675-4929-a274-74f02a7b3a1e`. Después falló el extractor porque stdout partía el UUID entre líneas; la orquestación restauró ambos workers antes de reconstruirlo. El pedido se procesó en worker-2 y ya no está pendiente. Estado final verificado: **ambos workers running**, API/broker healthy; cola Consumers=2, Ready=0, Unacked=0, Total=0. No hay escenario listo para screenshot y no se publicó otro pedido. Fallo de instrumentación documentado sin atribuirlo a la API. Captura GUI y procedimiento con workers apagados siguen pendientes; ningún CP formal completo.

El intento 1 y todos sus archivos originales permanecen intactos; lo siguiente describe exclusivamente ese intento.

## Resultado real

El intento se abortó **antes de Postman** el 2026-10-27T01:29:34.295128+00:00: Management devolvió `consumers: 2`, aunque Compose ya mostraba los dos workers `exited` y `consumer_details` estaba vacío. Posible desfase de estadísticas, no demostrado mediante espera. La comprobación fue demasiado inmediata; no se esperó actualización del contador. Se aplicó la excepción autorizada de restauración, sin repetir la publicación ni ocultar el fallo.

**Estado final: ambos workers running**, como al inicio. API y broker healthy. No hay escenario pendiente listo para captura. No se publicó ningún pedido: no hay orderId, request/response nuevos, HTTP 202 ni log order_published de esta unidad. No se ejecutó quantity cero.

## Comandos y evidencia original

Directorio de ejecución: `rabbitmq/` del taller; proyecto `qa-taller-integracion-rabbitmq`. Cada prefijo tiene `-comando.txt`, `-inicio.txt`, `-fin.txt`, `-stdout.txt`, `-stderr.txt` y `-exitcode.txt` originales.

| Prefijo | Comando | Exitcode |
| --- | --- | --- |
| 01-compose-antes | docker compose -p qa-taller-integracion-rabbitmq ps -a --format json | 0 |
| 02-api-health | curl --silent --show-error --fail --max-time 5 http://localhost:3000/health | 0 |
| 03-stop | docker compose -p qa-taller-integracion-rabbitmq stop notification-worker | 0 |
| 04-compose-parados | docker compose -p qa-taller-integracion-rabbitmq ps -a --format json | 0 |
| 05-cola-inicial | curl --silent --show-error --fail --max-time 5 --user admin:admin http://localhost:15672/api/queues/%2F/pedidos | 0 |
| restauracion-start | docker compose -p qa-taller-integracion-rabbitmq start notification-worker | 0 |
| restauracion-estado | docker compose -p qa-taller-integracion-rabbitmq ps -a --format json | 0 |

El comando de orquestación terminó **1** por `AssertionError('Cola inesperada')`; véase `FALLO.txt`. Los exitcodes 0 de Docker/curl no significan que se cumplieran las precondiciones del experimento.

Workers: `qa-taller-integracion-rabbitmq-notification-worker-1` y `qa-taller-integracion-rabbitmq-notification-worker-2`; ambos running → exited → running. No se detuvieron otros servicios.

Management inicial, JSON completo: `05-cola-inicial-stdout.txt`. `durable=true`, `consumers=2`, `messages_ready=0`, `messages_unacknowledged=0`, `messages=0`. No hay medición posterior de cola; no inventar conteos finales. No se consumió ni purgó ningún mensaje.

## Guía cubierta y pendientes

Intento preparatorio para Anexo 1 apartado 9 y evidencia parcial de consumidor ausente, sin completar ejecución Postman ni CP-09/11. No demuestra consumo posterior, ausencia de pérdida, recuperación ni elasticidad. No se crean CP completos sin los 11 campos requeridos.

**Pendiente:** nueva unidad autorizada con espera acotada del contador consumers tras detener workers; luego publicar un único pedido y dejar workers apagados para captura. Cuando exista escenario verificable, abrir `http://localhost:15672`, Queue `pedidos`, mostrando Ready >= 1, Unacked 0 y Consumers 0. **No se tomó captura GUI** ni se reutilizaron capturas previas.

Tras aportar la futura captura, y solo con autorización para continuar, comando desde `rabbitmq/`: `docker compose -p qa-taller-integracion-rabbitmq start notification-worker`; comprobar consumo posterior por el mismo ID. Este comando sí se ejecutó aquí exclusivamente como restauración del intento fallido, no como continuación exitosa del experimento.

RED: no activo — no se activó TDD estricto. GREEN: no activo — validación operativa reportada separadamente.
