# Anexo 1, apartado 9 — Postman CLI

## Resultado real

Postman CLI 1.77.0 ejecutó localmente las dos solicitudes existentes: **2 requests, 5 aserciones, 0 fallos, exitcode 0**. Pedro / Libro de arquitectura / quantity 1 devolvió HTTP 202, status accepted, mensaje esperado y orderId ORD-UUID; quantity 0 devolvió HTTP 400. Se guarda orderId como variable de colección. No se enviaron pedidos extra.

ID real: `ORD-abf9d555-aa78-4f7f-8ff6-ae0a520a816a`.

- HTTP 202: 192 ms; HTTP 400: 20 ms (no constituye CP-07 completo).
- Publicación: 2026-10-27T01:23:38.996Z.
- Recepción: 2026-10-27T01:23:39.024Z.
- Procesamiento: 2026-10-27T01:23:42.051Z, worker-2, instancia `aea9d0d7aa00`; mismo orderId/correlationId.

## Corrida 02 sin output

Desde raíz del repositorio: [comando literal](corrida-02-sin-output/comando.txt). Mantiene `--no-report-events --verbose --timeout 30000 --timeout-request 10000 --timeout-script 5000`; se eliminó únicamente `--output`. stdout/stderr se redirigieron por shell y se guardó `$?` inmediatamente, sin pipes.

- [Inicio UTC](corrida-02-sin-output/inicio.txt), [fin UTC](corrida-02-sin-output/fin.txt), [exitcode 0](corrida-02-sin-output/exitcode.txt).
- [stdout íntegro con HTTP real, scripts y cinco Pass](corrida-02-sin-output/stdout.txt), [stderr vacío](corrida-02-sin-output/stderr.txt).
- [Respuestas JSON extraídas del bloque HTTP verbose](corrida-02-sin-output/respuestas-extraidas.json), [ID](corrida-02-sin-output/orderId.txt). Son derivados; el original terminal se conserva sin modificar. Los scripts HTTP_EVIDENCE también están presentes, partidos en líneas por el renderizado de Postman.
- [Comando Docker logs](corrida-02-sin-output/logs-comando.txt), [logs originales](corrida-02-sin-output/docker-logs-stdout.txt), [stderr](corrida-02-sin-output/docker-logs-stderr.txt), [exitcode 0](corrida-02-sin-output/docker-logs-exitcode.txt), [solo mismo ID](corrida-02-sin-output/logs-mismo-id.txt), [fin consulta](corrida-02-sin-output/logs-fin.txt). Consulta con condición finita, máximo diez intentos separados por un segundo hasta order_processed; sin polling de jobs.
- [Compose después](corrida-02-sin-output/compose-ps-despues.txt), [exitcode](corrida-02-sin-output/compose-ps-exitcode.txt): ambos workers continúan activos. No se intervino su ciclo de vida.

El CLI imprimió avisos `No authorization data found` y `Postman credentials are required for publishing run details to Postman cloud`, **pero ejecutó las solicitudes y finalizó 0**. No se inició sesión ni se proporcionaron claves. Se usó `--no-report-events`; no se afirma una auditoría independiente de tráfico.

## Corrida inicial preservada

[Comando con --output](comando.txt), [stdout](stdout.txt), [stderr](stderr.txt), [exitcode 1](exitcode.txt), [inicio](inicio.txt), [fin](fin.txt), [Postman](postman-version.txt), [Node](node-version.txt), [ayuda](collection-run-help.txt), [Compose previo](compose-ps-antes.txt).

El exitcode 1 previo **solo bloqueó el reporte YAML mediante --output**: `You must be signed in to use --output`. No probaba que collection run sin ese flag requiriese login. Esta segunda corrida fue autorizada tras diagnosticar esa precondición, no tras timeout. Todos los archivos originales de la corrida inicial se conservan intactos; se actualiza únicamente este resumen y el plan.

## Alcance y pendientes

Evidencia terminal real del apartado 9 RabbitMQ; sin reporte YAML/JSON/HTML nativo ni screenshots GUI. El JSON derivado no es un reporter oficial. Faltan capturas reales de Postman y Management de `pedidos` (Ready/Unacked/Total) vinculadas al flujo. No se instalaron browsers ni se fabricaron imágenes. No se purgó cola ni eliminó volumen ni se modificó aplicación/Compose.

No se ejecutó Kafka ni se completaron todos los CP; en particular CP-07/10/12 requieren procedimientos adicionales. Faltan reportes formales de 11 campos; no se marcan CP completos.

RED: no activo — no se activó TDD estricto y no se inventó defecto de API. GREEN: no activo — validación separada: integración Postman 5/5 aserciones aprobadas. La aplicación ya funcionaba; esta unidad es ejecución documentada.
