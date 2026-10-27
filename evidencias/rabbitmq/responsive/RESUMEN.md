# CP-07 RabbitMQ — Cumple

[Reporte de 11 campos](reporteCP07.md): corrida 03, pedido `ORD-b7a74952-2957-49cb-a5db-f88d7b2ce443`. HTTP 202 en 27 ms con consumidores apagados y mensaje pendiente; el mismo pedido fue recibido y procesado tras iniciarlos varios minutos después. Evidencia existente, sin runtime nuevo.

| Evento (UTC, 2026-10-27) | Valor | Fuente |
| --- | --- | --- |
| HTTP | 202, 27 ms, 4/4, exitcode 0 | [stdout](../consumidores-apagados/corrida-03/06-postman-stdout.txt) / [exitcode](../consumidores-apagados/corrida-03/06-postman-exitcode.txt) |
| Publicación API | 01:39:39.627Z | [log API](../consumidores-apagados/corrida-03/logs-mismo-id.txt) |
| Recepción worker-2 | 01:46:31.200Z | [log worker](../consumidores-apagados/corrida-03/consumo-posterior/logs-mismo-id-notification-worker.txt) |
| Procesamiento worker-2 | 01:46:34.229Z | Mismo log, instancia `aea9d0d7aa00` |
| Intervalos derivados | Publicación→recepción 411.573 s; recepción→procesamiento 3.029 s | Diferencias entre eventos de aplicación, no fin HTTP |

Capturas reales enlazadas en el reporte: HTTP CLI (no GUI Postman), Management pendiente/final y Docker Desktop worker-2 (líneas anteriores al lote CP-10). El requisito no exige consumidores activos ni umbral de latencia. No se afirma fin HTTP absoluto exacto, benchmark, SLA, exactly-once ni recuperación.

Validación documental offline: [script](validar.mjs), [registro de ejecución](check.json). No añade parser de HTTP_EVIDENCE: usa el extractor existente para identidad y mantiene explícita la limitación temporal. CP-01/02/03/06/10/11 preservados; con CP-07 son **7 de 10 RabbitMQ**. CP-08/09/12 y Kafka siguen pendientes.
