# CP-09 RabbitMQ — continuidad ante consumidor detenido

**Cumple**, conclusión propia del [reporte de 11 campos](reporteCP09.md), no calificación del profesor. Revisión offline de corrida 03, `ORD-b7a74952-2957-49cb-a5db-f88d7b2ce443`; no operaciones nuevas.

| Evidencia | Papel en CP-09 |
| --- | --- |
| [Stop original](../consumidores-apagados/corrida-03/03-stop-comando.txt), [exitcode 0](../consumidores-apagados/corrida-03/03-stop-exitcode.txt), [Compose detenido](../consumidores-apagados/corrida-03/04-parados-stdout.txt) | Caída simulada controladamente: ambos workers exited (contenedores ExitCode 137), API/broker healthy |
| [Baseline](../consumidores-apagados/corrida-03/baseline.json), [HTTP original](../consumidores-apagados/corrida-03/06-postman-stdout.txt), [API](../consumidores-apagados/corrida-03/logs-mismo-id.txt) | Cola vacía, única aceptación 202/27 ms, 4/4 y publicación del mismo ID con Consumers=0 |
| [Cola pendiente](../consumidores-apagados/corrida-03/cola-final.json), [Compose posterior](../consumidores-apagados/corrida-03/10-final-stdout.txt), [snapshot histórico](../consumidores-apagados/corrida-03/resultado.json) | Ready=1/Unacked=0/Total=1, ambos workers exited a 2026-10-27T01:39:45.394411+00:00; API/broker healthy |
| [Start original](../consumidores-apagados/corrida-03/consumo-posterior/03-start-comando.txt), [exitcode 0](../consumidores-apagados/corrida-03/consumo-posterior/03-start-exitcode.txt), [logs worker](../consumidores-apagados/corrida-03/consumo-posterior/logs-mismo-id-notification-worker.txt), [final](../consumidores-apagados/corrida-03/consumo-posterior/resultado-final.json) | Regreso sin otra publicación; mismo ID recibido/procesado por worker-2, final 0/0/0, Consumers=2 |

## Capturas reales existentes

- [HTTP CLI guardado](../casos-funcionales/postman-cli-pedido-aceptado.png), no GUI de Postman ni ejecución nueva.
- [Management pendiente](../consumidores-apagados/corrida-03/management-pedido-pendiente.png): Ready=1, Consumers=0, Persistent=1, durable=true.
- [Management final](../consumidores-apagados/corrida-03/consumo-posterior/management-pedido-consumido.png): 0/0/0 y Consumers=2.
- [Worker-2](../reparto-carga/docker-logs-worker-2.png): líneas b7a de 01:46:31/34, no lote CP-10.

Publicación **2026-10-27T01:39:39.627Z**, recepción **01:46:31.200Z**, procesamiento **01:46:34.229Z**, instancia `aea9d0d7aa00`. Snapshot final **01:46:40.985636+00:00**: API/broker healthy, workers running. Son estados históricos, no una consulta live actual.

## Alcance y siguiente paso

Guía p. 4: soportar caída del consumidor; stop controlado simula su indisponibilidad. Dos workers y un pedido son selección local, no requisito ni ensayo de escala. Contadores Management no identifican payload: correlación por baseline vacío, publicación única y logs coincidentes, sin Get messages. CP-11 observa almacenamiento/separación temporal; CP-09 continuidad API y regreso; CP-07 respuesta sin esperar. CP-12 pendiente: no interrupción en vuelo antes de ack ni reentrega de b7a (redelivered=false). Sin SLA, HA, fallo broker/AMQP ni garantía general de no pérdida. [Intentos anteriores](../consumidores-apagados/RESUMEN.md) preservados y separados.

[Validación offline](validacion.json): campos, enlaces/capturas existentes, comandos históricos y exitcodes, estados/salud, ID/timestamps, contadores y matriz. No TDD de aplicación: solo documentación, sin cambio de comportamiento. RabbitMQ **9 de 10** (CP-12 pendiente); Kafka y PDF final pendientes. No ejecutar otra operación para este cierre.
