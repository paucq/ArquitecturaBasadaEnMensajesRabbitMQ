# CP-06 RabbitMQ — traza nativa del broker

**CP-06 RabbitMQ: Cumple; cierre documental, conclusión propia, no calificación del profesor.** Se publicó un único pedido en la [corrida 01](corrida-01/technical-result.json), sin repetirlo al retomar la sesión tras la interrupción del subagente. La aplicación y Compose no se modificaron.

## Identidad y recorrido

- Fecha: 2026-10-27, horas UTC.
- Pedido y correlación: `ORD-8d488fb8-62c9-4e37-935d-31aed2a8aa9e`.
- Entrada: Pedro / Libro de arquitectura / quantity=1.
- Postman CLI: HTTP 202 Accepted, 1655 ms, una solicitud, 4/4 aserciones, [exitcode 0](corrida-01/017-postman-single-request-execution.json). [Salida original](corrida-01/017-postman-single-request-stdout.txt). Los avisos de login/cloud del CLI no impidieron la ejecución local; no se inició sesión ni se publicó el resultado en Postman cloud.

| Fuente original | Evento | Hora UTC |
| --- | --- | --- |
| [Broker nativo](corrida-01/broker-native-original.jsonl) | `published`, routing_keys=[pedidos], routed_queues=[pedidos] | 02:42:35.087 |
| [Broker nativo](corrida-01/broker-native-original.jsonl) | `received`, queue=pedidos | 02:42:35.103 |
| [API](corrida-01/logs-orders-api-same-id.txt) | `order_published` | 02:42:35.123 |
| [worker-1](corrida-01/logs-notification-worker-same-id.txt) | `order_received` | 02:42:35.158 |
| [worker-1](corrida-01/logs-notification-worker-same-id.txt) | `order_processed` | 02:42:38.411 |

Los dos registros del broker contienen `properties.correlation_id` y `properties.message_id` iguales al ID anterior; el payload original, codificado en base64 por el plugin, contiene el mismo `orderId`. `received` es el nombre nativo del evento de entrega desde el broker, **no** un ack ni prueba de procesamiento completo. El procesamiento se acredita con el log del worker: 3.253 s desde su recepción.

El log API `order_published` se escribe después de la confirmación de publicación, por lo que su timestamp puede ser posterior a los eventos del broker. No se cambia el orden de los registros para simular un recorrido cronológico distinto. Las marcas de tiempo de la tabla son las de cada evento, no las de recolección de Docker.

## Captura real y cierre

[Captura real aportada por el usuario y revisada completa por el padre](corrida-01/captura-trazabilidad-api-broker-worker.png): API, BROKER NATIVO y WORKER-1 del mismo ID. Es captura de [VISTA_EVIDENCIAS.txt](corrida-01/VISTA_EVIDENCIAS.txt), explícitamente DERIVADA de fuentes originales reales con payload decodificado, no GUI ni JSONL nativo modificado. Los originales enlazados arriba se conservan intactos. No falta captura: [CP-06](../casos-funcionales/reporteCP06.md) queda Cumple y marcado en RabbitMQ. Sin repetir solicitudes ni operaciones runtime.

## Mecanismo oficial y archivos

RabbitMQ 4.4.0 incluye `rabbitmq_tracing`. Se habilitó temporalmente online; se creó una sola traza con nombre único, vhost `/`, formato JSON y patrón `#`. El plugin consumió los eventos Firehose y escribió su propio archivo. Se exportó mediante la API `/api/trace-files/<nombre>` **antes** de eliminar la traza propia. No se reemplaza esta evidencia por los logs operativos de Docker: [el filtro de esos logs por ID está vacío](corrida-01/logs-rabbitmq-same-id.txt), como era esperable.

Fuentes oficiales consultadas:

- [Firehose: alcance, formato y activación/desactivación](https://www.rabbitmq.com/docs/firehose).
- [README del plugin, tag v4.4.0: API, configuración y coste](https://github.com/rabbitmq/rabbitmq-server/blob/v4.4.0/deps/rabbitmq_tracing/README.md).
- [Implementación del formato JSON/base64, tag v4.4.0](https://github.com/rabbitmq/rabbitmq-server/blob/v4.4.0/deps/rabbitmq_tracing/src/rabbit_tracing_consumer.erl); [copia consultada](corrida-01/004-official-format-source-stdout.txt).

Archivos clave:

- [Identidad de la traza](corrida-01/trace-identity.json), [estado inicial](corrida-01/initial-state.json) y [metadatos tras publicar](corrida-01/021-trace-metadata-after-order-stdout.txt).
- [JSONL nativo original](corrida-01/broker-native-original.jsonl), sin alterar; [decodificación derivada](corrida-01/broker-decoded-DERIVED.json) y [correlación verificada](corrida-01/correlacion-validada.json).
- Cada operación de la corrida conserva `*-execution.json` con comando, timestamps y exitcode, además de stdout/stderr. Los nombres numerados permiten reconstruir su orden.
- [Orquestador de la única corrida](run-cp06.mjs) con guardia que rechaza una carpeta existente, [decodificador](trace-format.mjs) y [tests offline](trace-format.test.mjs). No volver a ejecutar el orquestador: la corrida ya existe.

## Interrupción y restauración verificadas

La interrupción ocurrió después de exportar la evidencia y de registrar [el borrado de la traza propia](corrida-01/027-delete-only-own-trace-execution.json), [la lista restante vacía](corrida-01/028-remaining-traces-stdout.txt) y [trace_off exitcode 0](corrida-01/029-restore-firehose-off-execution.json). No quedó registro del exitcode del comando posterior de deshabilitación del plugin; **no se inventa uno ni se afirma que el orquestador finalizó normalmente**.

Al retomar, el padre comprobó que el orquestador ya no estaba activo y que la lista de plugins habilitados coincidía exactamente con la inicial: `rabbitmq_tracing` deshabilitado, Management y Prometheus conservados. Firehose estaba apagado. Por ello no fue necesario volver a ejecutar desactivaciones. El chequeo de `/api/traces` devolvió HTTP 404 / curl exitcode 22, esperado al estar deshabilitado el plugin; `pgrep` devolvió 1 al no encontrar el orquestador. Son diagnósticos registrados, no fallos de API de pedidos.

[Estado final independiente](corrida-01/resume-final-state.json) y [verificación de limpieza](corrida-01/cleanup-verification.json):

- API y broker healthy; dos workers running, mismos contenedores.
- Consumers=2; Ready=0, Unacked=0, Total=0; API `/health` ready.
- Plugins y estado Firehose restaurados. Sin reinicios, purgas ni cambios de volúmenes.
- Archivo diagnóstico propio conservado en el broker, con copia local no vacía; no hay traza activa. No se borraron archivos de evidencia.

## Validación y límites

Tests offline del formato nativo: 3/3 PASS, tanto en la ejecución original como en la revisión del padre. [Validación offline guardada](corrida-01/validacion-offline.json): 83 enlaces locales existentes, 11 campos del reporte, dos eventos nativos, payload/message_id/correlation_id coherentes, un evento API, recepción/procesamiento del worker, Postman exitcode 0 y restauración verificable. El SHA-256 del JSONL exportado coincide exactamente con el archivo original conservado en el broker: `04c9a549f36c5253a7e2ee3927a6e403a38b20609b4c967bbb08f613c3f99146`; [chequeo directo en el broker](corrida-01/resume-08-broker-file-check-stdout.txt). Los 83 enlaces corresponden a la comprobación anterior a añadir estos dos enlaces de validación. Diagnósticos LSP sobre los siete archivos revisados: dos advertencias de uso de console en el orquestador CLI, sin errores notificados; no es código productivo.

La traza añade consumo de recursos y registra contenido del mensaje; se limitó al laboratorio local y se desactivó al terminar. Esta corrida no es un benchmark, no demuestra exactly-once ni recuperación ante caída, y no cierra CP-07/08/09/12. No mezclar este nuevo ID con la corrida 03 de CP-01/02/03/11 ni con el lote CP-10. La captura recibida completa la evidencia visual, sin petición adicional. La validación offline anterior conserva el pendiente visual histórico; el cierre se valida por separado.
