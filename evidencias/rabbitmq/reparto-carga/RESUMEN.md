# Reparto RabbitMQ demostrado — CP-10 Cumple

**Cumple según nuestro reporte, no calificación del profesor:** una sola corrida de seis pedidos válidos, seis IDs únicos y **24/24 aserciones**. Cada ID tiene publicación, recepción y procesamiento; ambas instancias procesaron pedidos (3 y 3 observados, no exigidos). Ningún ID aceptado quedó sin procesar **en este lote**. Las capturas reales de Docker Desktop Logs de [worker-1](docker-logs-worker-1.png) y [worker-2](docker-logs-worker-2.png) muestran tres `order_processed` por instancia con los seis IDs de la tabla; respaldan el cierre documental de CP-10 RabbitMQ.

## Parámetros y ejecución

Fecha: 2026-10-27, UTC. Seis repeticiones del ejemplo Pedro / Libro de arquitectura / quantity=1: tamaño elegido para laboratorio, no requisito del profesor. Ambos workers ya estaban activos. No se ejecutó la solicitud quantity=0.

Desde `rabbitmq/`:

```sh
postman collection run pruebas/RabbitMQ.postman_collection.json -i 'Crear pedido — esperado HTTP 202' --iteration-count 6 --timeout 60000 --timeout-request 10000 --timeout-script 5000 --no-report-events --verbose
```

Sin `--output`, login, cloud, suppress-exit-code ni reintentos. [Comando literal](03-postman-comando.txt), [stdout HTTP original](03-postman-stdout.txt), [stderr](03-postman-stderr.txt), [exitcode 0](03-postman-exitcode.txt), [inicio UTC](03-postman-inicio.txt), [fin UTC](03-postman-fin.txt).

Orquestación única: `node herramientas/run.mjs` lanzada en background y esperada; [código auditable](herramientas/run.mjs), [exitcode global 0](operacion-exitcode.txt). Cada subcomando conserva `*-comando.txt`, `*-inicio.txt`, `*-fin.txt`, `*-stdout.txt`, `*-stderr.txt`, `*-exitcode.txt`, sin pipelines. Todos los comandos live terminaron con 0.

## Precondición y cierre

- [Compose inicial JSONL](01-compose-stdout.txt): dos workers running, API/broker healthy.
- [Management inicial JSON](02-management-stdout.txt): Consumers=2, Ready=0, Unacked=0, Total=0. No hizo falta esperar el baseline (máximo previsto 30 s).
- Espera única finita después de publicar: hasta 60 s para los seis `order_processed` y cola vacía con dos consumidores. [Últimos logs de espera](04-wait-7-logs-stdout.txt), [última consulta](04-wait-7-queue-stdout.txt).
- [Logs originales API/ambos workers/broker](05-logs-stdout.txt), con `--no-color --timestamps --since` el inicio del lote, conservados antes de derivar la tabla.
- [Management final](06-management-final-stdout.txt): Consumers=2, Ready=0, Unacked=0, Total=0.
- [Compose final JSONL](07-compose-final-stdout.txt): ambos workers running, API/broker healthy.
- [Resultado de aserciones y conteo](resultado.json), [IDs](ids.json), [tabla completa por pedido](tabla.json), [validación offline final](validacion.json): enlaces, JSON/JSONL, seis IDs, eventos, exitcodes y estado final correctos (exitcode del validador 0).

## Trazabilidad por pedido

Todas las horas siguientes son UTC del 2026-10-27. `worker-1` = notification-worker-1 / instancia `9daaf02d21e3`; `worker-2` = notification-worker-2 / instancia `aea9d0d7aa00`.

| orderId | Publicación | Received | Processed | Worker | redelivered |
| --- | --- | --- | --- | --- | --- |
| ORD-d047fa00-4ab7-4753-8162-a70551aaedb8 | 01:58:33.860 | 01:58:33.864 | 01:58:36.870 | worker-2 | false |
| ORD-962eb263-4dcf-488c-8cda-3e4c81eecac0 | 01:58:33.971 | 01:58:33.983 | 01:58:36.998 | worker-1 | false |
| ORD-f83a6ad1-6a43-470e-8965-1af15a07f6e5 | 01:58:34.026 | 01:58:36.881 | 01:58:39.883 | worker-2 | false |
| ORD-fbd6453d-7827-4b34-acee-9830dbcb9641 | 01:58:34.068 | 01:58:37.009 | 01:58:40.015 | worker-1 | false |
| ORD-462f5dc3-ff41-4990-b841-a9f4685c1eda | 01:58:34.295 | 01:58:39.885 | 01:58:42.889 | worker-2 | false |
| ORD-e3d243ec-52e8-4afe-a5ca-442066ef336e | 01:58:34.448 | 01:58:40.019 | 01:58:43.023 | worker-1 | false |

Conteos: **worker-1: 3; worker-2: 3**. Cada ID registra exactamente una publicación, recepción y procesamiento en los logs de este lote. No se exige distribución 3/3 ni se infiere escalabilidad lineal sin comparación 1 vs. 2. Tampoco demuestra exactly-once, ausencia general de pérdida ni recuperación.

## Parser offline y evidencia de prueba

Nuevo [parser por lote](herramientas/batch.mjs), sin sobrescribir el extractor anterior: reconstruye los bloques HTTP multilínea y parsea JSON; exige HTTP 202, accepted, mensaje esperado, seis respuestas y seis UUID únicos. No extrae UUID de texto de tests ni de `HTTP_EVIDENCE`.

Comando: `node --test herramientas/batch.test.mjs` desde esta carpeta.

- [RED stdout](RED-stdout.txt), [stderr](RED-stderr.txt), [exitcode 1](RED-exitcode.txt): módulo todavía inexistente, sin invocar API.
- [GREEN 5/5](GREEN-stdout.txt), [exitcode 0](GREEN-exitcode.txt): antes de publicar, fixture real corrida-03 + lote sintético seis, duplicados, sin respuestas, HTTP no 202.
- [TRIANGULATE](TRIANGULATE-stdout.txt), [exitcode](TRIANGULATE-exitcode.txt): añade después del live fixture real corrida-02 y JSON malformado. [Tests](herramientas/batch.test.mjs).

## Límites y cierre documental

No hubo stop/start, purga, Get messages, escalado, reinicios ni cambios de app/Compose/colección. Kafka y otros CP no se ejecutaron. Los fallos históricos pertenecen a otras corridas y quedan intactos: [Postman --output](../postman-cli/RESUMEN.md), [consumidores apagados y extractor previo](../consumidores-apagados/RESUMEN.md).

Las capturas reales de [worker-1](docker-logs-worker-1.png) (`9daaf02d21e3`: `962eb263`, `fbd6453d`, `e3d243ec`) y [worker-2](docker-logs-worker-2.png) (`aea9d0d7aa00`: `d047fa00`, `f83a6ad1`, `462f5dc3`) corresponden al lote del 2026-10-27, 01:58:33–43 UTC; los fragmentos identifican los UUID completos de la tabla. Demuestran directamente el reparto y complementan el JSON Management final ya conservado; no se exige otra captura GUI de cola. Los logs y JSON originales siguen identificados como evidencia CLI nativa y se conserva la historia de comandos. [Reporte CP-10 con 11 campos y estado Cumple](reporteCP10.md).
