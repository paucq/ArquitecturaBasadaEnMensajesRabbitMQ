# Cobertura funcional y reactiva RabbitMQ — revisión offline

Reportes de 11 campos. CP-01/02/03 reutilizan evidencia existente, sin nuevas solicitudes para su documentación. CP-06 se amplió después con una única corrida autorizada de trazabilidad y diagnóstico nativo temporal, ya desactivado. Fuente normativa: guía del taller p. 4 (casos/formato) y Anexo 1 pp. 7–13; plantilla del PLAN §7.4. «Pendiente evidencia» es un estado documental provisional, no un defecto ni un Cumple.

| Caso | Estado | Fuentes y alcance | Pendiente preciso |
| --- | --- | --- | --- |
| [CP-01](reporteCP01.md) | Cumple | HTTP CLI real: 202, 27 ms, 4/4; [captura real de salida CLI guardada](postman-cli-pedido-aceptado.png) y [stdout original corrida 03](../consumidores-apagados/corrida-03/06-postman-stdout.txt) | Ninguno para aceptación HTTP; captura no es GUI de Postman ni corrida nueva |
| [CP-02](reporteCP02.md) | Cumple | Baseline vacío, publicación única, log API y captura Management Ready=1 | Ninguno para envío; captura no muestra ID/payload |
| [CP-03](reporteCP03.md) | Cumple | Captura worker-2 con ID recibido/procesado y Management final vacío | Ninguno para procesamiento observado |
| [CP-06](reporteCP06.md) | Cumple | [Corrida de trazabilidad 01](../trazabilidad/RESUMEN.md): mismo ID en API, dos eventos nativos del broker y worker; diagnóstico restaurado | Ninguno para este CP; [captura real de vista derivada](../trazabilidad/corrida-01/captura-trazabilidad-api-broker-worker.png), no GUI ni JSONL nativo modificado |

## Identidad y límites

CP-01/02/03 usan corrida 03: `ORD-b7a74952-2957-49cb-a5db-f88d7b2ce443`, correlationId igual. Publicación 2026-10-27T01:39:39.627Z; recepción 01:46:31.200Z; procesamiento 01:46:34.229Z (UTC del mismo día). Las capturas worker-2 se reutilizan solo por esas líneas previas al lote CP-10. No se mezclan el ID abf9 de Postman corrida 02 ni los seis IDs/24 aserciones de reparto de carga.

El incremento de cola prueba envío sin inspeccionar payload; no satisface por sí solo trazabilidad estricta del broker. CP-06 ahora usa exclusivamente el nuevo `ORD-8d488fb8-62c9-4e37-935d-31aed2a8aa9e`: archivo nativo JSONL del plugin RabbitMQ con message_id/correlation_id y payload base64 correlacionados con API y worker-1. La corrida se ejecutó una vez y el diagnóstico temporal quedó apagado; el padre verificó la restauración tras la interrupción del subagente. Captura real recibida y revisada completa por el padre: CP-06 Cumple y marcado, conclusión propia, no calificación del profesor. No se afirma exactly-once. CP-10/11 existentes se preservan; Kafka y recuperación quedan fuera. La captura deriva de fuentes originales reales conservadas; no se fabrican imágenes ni se hizo otra petición.

## Ampliación CP-07 — Responsive

[CP-07 RabbitMQ: Cumple](../responsive/reporteCP07.md), [fuentes y validación offline](../responsive/RESUMEN.md). Misma corrida 03 b7a: HTTP 202/27 ms mientras Consumers=0 y Ready=1; procesamiento posterior del mismo ID, intervalo observado 3.029 s. Capturas reales ya existentes, sin mezclar corrida de CP-06 ni IDs del lote CP-10. No es benchmark ni SLA. Sin runtime nuevo. Se preservan CP-01/02/03/06/10/11; total RabbitMQ entonces **7 de 10**, pendientes CP-08/09/12 en esa etapa; Kafka pendiente.

## Ampliación CP-08 — Message-driven — estado vigente

[CP-08 RabbitMQ: Cumple](../message-driven/reporteCP08.md), [fuentes y validación offline](../message-driven/RESUMEN.md). Código/configuración completos revisados: API publica por AMQP y worker consume pedidos vía broker, sin llamada directa API–worker en la implementación inspeccionada. Se reutiliza únicamente corrida de trazabilidad 01, ID `ORD-8d488fb8-62c9-4e37-935d-31aed2a8aa9e`, con eventos nativos published/received, payload correlacionado y [captura real de vista derivada](../trazabilidad/corrida-01/captura-trazabilidad-api-broker-worker.png). Docker solo no prueba mediación; received no es ack. Sin operaciones nuevas ni reactivación de tracing. CP-07 y originales preservados. Cobertura **CP-01/02/03/06/07/08/10/11 = 8 de 10**; pendientes **CP-09/12** y todo Kafka. No se declaran resiliencia, recuperación ni exactly-once en esa etapa.

## Ampliación CP-09 — Resilient — estado vigente

[CP-09 RabbitMQ: Cumple](../resilient/reporteCP09.md), [fuentes, capturas y validación offline](../resilient/RESUMEN.md). Corrida 03 b7a exclusivamente: stop controlado de ambos workers simula caída, Consumers=0; API/broker healthy antes y durante, HTTP 202/27 ms y publicación con Ready=1/Unacked=0/Total=1. Tras el start original sin otra publicación, mismo ID recibido 01:46:31.200Z y procesado 01:46:34.229Z por worker-2; final Consumers=2 y 0/0/0. Capturas reales ya existentes, no GUI nueva ni traza 8d de CP-06. Cierre documental sin operaciones nuevas.

CP-09 demuestra continuidad de API ante indisponibilidad simulada y regreso del consumidor; CP-11 almacenamiento/separación temporal, CP-07 respuesta sin esperar. CP-12 pendiente: no interrupción de b7a en vuelo antes del ack ni reentrega (redelivered=false). Sin SLA, HA ni «no pérdida» general. Intentos 01/02 preservados, no mezclados. Cobertura **CP-01/02/03/06/07/08/09/10/11 = 9 de 10**; solo **CP-12** pendiente RabbitMQ, todo Kafka y PDF final pendientes. Estados anteriores son históricos.


### CP-12 RabbitMQ — cierre documental con captura: Cumple

[Reporte de 11 campos](../recuperacion/reporteCP12.md) y [fuentes, comandos y límites](../recuperacion/RESUMEN.md). Corrida nueva, `ORD-ea298437-f581-4b8f-b80d-2706f3659b80`: una solicitud Postman HTTP 202/71 ms, 4/4, exitcode 0. Worker-1 recibió redelivered=false a 03:46:24.274Z; SIGSTOP breve de instrumentación; snapshot Unacked=1/Consumers=1 antes del stop abrupto SIGKILL (orden exitcode 0, target exited/137). Antes de iniciar: Ready=1/Unacked=0/Consumers=0. Mismo ID reentregado con redelivered=true a 03:46:45.109Z y procesado 03:46:48.123Z (3.014 s). Final 03:46:52.947Z: mismos cuatro IDs, dos workers running/no paused, API/broker healthy y cola 0/0/0/Consumers=2. recovery.json original conserva TECHNICALLY_VERIFIED_VISUAL_PENDING; fin 03:46:53.157Z, cleanup=[].

**Estado: Cumple**, conclusión propia, no evaluación del profesor. [Captura real CP-12 aportada por el usuario y revisada completa por el padre](../recuperacion/corrida-01/captura-recuperacion-worker.png), de la [vista DERIVADA de fuentes originales reales](../recuperacion/corrida-01/VISTA_EVIDENCIAS.txt), no GUI ni log nativo modificado. La leyenda «captura PENDIENTE» de la vista/imagen y el estado de recovery.json son históricos, anteriores a recibir la foto; se conservan sin reescribir. No falta captura actual ni se usa la imagen incorrecta CP-06.

Recuperación del worker con trabajo en Unacked, no del broker. Dos entregas y un processed del mismo ID no prueban exactly-once; 3.014 s es observación, no garantía general de latencia, HA, downtime cero ni ausencia universal de pérdida/efectos duplicados. Originales y casos anteriores preservados, sin runtime nuevo.

Solo se añade la casilla CP-12 RabbitMQ: **RabbitMQ 10/10**, CP-01/02/03/06/07/08/09/10/11/12 completos. **Kafka 0/10**, entero sin marcar; PDF final pendiente. No se declaran 20/20 ni entrega lista. Los estados y pendientes anteriores son etapas históricas. [Validación offline del cierre](../recuperacion/validacion-cierre.json).
