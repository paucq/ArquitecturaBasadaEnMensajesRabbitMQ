# CP-12 RabbitMQ — protocolo de diseño

Este documento conserva el diseño previo al ensayo; resultados y cierre en el [reporte CP-12](reporteCP12.md). No es una instrucción para repetir la corrida.

## Preflight real

2026-10-27T03:30:23.312Z–03:30:32.736Z: [lecturas originales](preflight/lecturas.json), con argv, UTC inicio/fin, stdout/stderr y exitcode individual. Compose ps, inspect acotado, logs y cuatro GET: exitcode 0. Workers `9daaf02d21e3` y `aea9d0d7aa00` running/no paused; API/broker healthy; `/health` ready; pedidos durable, Ready=Unacked=Total=0, Consumers=2, ack_required=true/prefetch=1. Conexiones: heartbeat negociado timeout=60 s, Node v24.22.1/amqplib 0.10.9. Inspect conserva IDs completos y entrypoint `docker-entrypoint.sh`, args `node worker.mjs`, restart `unless-stopped`.

No se publicó, detuvo ni señaló ningún proceso. `docker kill --help` agotó timeout (exitcode null, error ETIMEDOUT): no prueba soporte operativo de señales. En ese preflight no se realizó consulta directa del PDF ni se instalaron herramientas. El criterio CP-12 corresponde a guía p. 4 (casos/formato) y Anexo 1 pp. 7–13; el contraste normativo posterior está en la [auditoría documental](../../../docs/entrega/AUDITORIA_GUIA_INICIAL.md).

## Elección propuesta para la siguiente unidad

**Un pedido, un worker target, congelación breve de PID1 y parada abrupta manual.** Preferir `docker stop --signal SIGKILL --timeout 0 TARGET` después del gate Unacked, en lugar de depender de `docker kill` con `unless-stopped`: la parada manual explicita que debe permanecer detenido. Verificar previamente documentación/soporte de esta sintaxis y semántica del Engine instalado. No cambiar restart policy ni Compose. Si no puede garantizarse target detenido sin autorestart, no publicar; solicitar revisión del operador, sin ensayo alternativo automático.

`SIGSTOP` suspende ejecución de PID1, no cierra su conexión AMQP ni equivale a Docker pause (freezer de todo el contenedor). Docker puede seguir mostrando running/no paused. `SIGKILL` termina sin ack/shutdown; `SIGCONT` revierte STOP, no resucita un proceso muerto. Inspección confirma launcher y argumentos, **no demuestra por sí sola Node PID1**: verificar antes de publicar mediante lectura acotada del proceso/entrypoint de esta imagen, autorizada por el operador. No experimentar enviando señales en preflight. La propuesta no es un ensayo validado.

## Máquina de estados del script de ensayo

1. Guardia exclusiva de corrida (creación exclusiva, nunca sobrescribir); registrar IDs completos/labels y baseline fresco. Exigir exactamente los cuatro contenedores esperados, dos workers running/no paused, health API/broker y cola 0/0/0/2. Abortar sin mutaciones si stale. Registrar cada comando, salida cruda, UTC, exitcode y reloj monotónico.
2. Detener solo worker-2 con cola vacía; esperar Consumers=1/cola vacía, máximo 20 s. Mantener IDs originales, nunca recrear. Armar lector `docker logs --follow --since TRIAL_UTC TARGET`, parser JSON por líneas fragmentadas, listo antes de publicar; vigilar salida prematura.
3. Lanzar **una sola vez** Postman CLI local, colección existente, solo item «Crear pedido — esperado HTTP 202», `--no-report-events --verbose`, sin `--output`. Conservar HTTP raw/4 asserts y código. No ejecutar colección completa ni reintentar solicitud. Identificador lo genera API, no el helper.
4. Primer `order_received` nuevo del target con UUID válido, correlationId igual y redelivered=false dispara SIGSTOP inmediatamente (objetivo <3 s, no garantía). Este STOP es instrumentación reversible; el fallo destructivo todavía NO está permitido. No esperar fin de Postman para congelar. Después extraer HTTP ID con parser existente y exigir igualdad con ID del stream y publicación API. Sin ID/tag propio en worker, no afirmar que existe: exclusividad + baseline + UUID correlacionado son la protección.
5. Dentro de **12 s desde STOP** exigir GET cola Ready=0/Unacked=1/Total=1/Consumers=1 y ausencia de order_processed de ese ID en logs hasta congelación. Poll cada 250 ms, GET timeout ≤1 s; estadísticas pueden tardar ~5 s. Revalidar target/IDs, sin EOF inesperado del watcher. Si ya procesó, snapshot contradictorio, HTTP falla o vence plazo: NO SIGKILL, restaurar y registrar fallo de instrumentación, sin republicar.
6. Solo con gates completos: parada manual abrupta SIGKILL propuesta; capturar salida/estado exited. Esperar máximo 20 s por Ready=1/Unacked=0/Total=1/Consumers=0; guardar snapshot **antes de start**. Si autorestart o plazo vencido, fallo, no esconderlo.
7. Start solo target original. Esperar ≤20 s recepción mismo ID redelivered=true y order_processed posterior (~3 s nominales); conservar API y ambos logs desde UTC inicial. Luego restaurar worker-2. Esperar ≤30 s estado final: IDs iguales, dos workers running/no paused, API/broker healthy, cola 0/0/0/2. No Get messages, tracing, purga, conexión AMQP adicional ni override de demora.

## Restauración y pruebas offline requeridas

Try/finally + handlers de interrupción y watchdog local acotado, sin daemon huérfano. Registrar intención STOP antes de emitirlo: un timeout de Docker no implica que no aplicó. En finally, inspeccionar IDs: target posiblemente congelado/running → SIGCONT; exited → start original; worker-2 detenido por esta corrida → start original. No tocar contenedor sustituto si ID cambió: reportar restauración incompleta al operador. Restauración también tiene plazos y evidencia; cerrar solo el proceso hijo lector propio, esperar su salida. SIGKILL del propio script no ejecuta finally: watchdog/operador debe poder recuperar con los IDs guardados. Nunca killall/pgrep ni modificar servicios ajenos.

Antes de live, TDD del helper: chunks/UUID envuelto, múltiples IDs, logs históricos, EOF, deadline, HTTP no coincidente, processed antes de STOP, orden STOP→Unacked→fallo, exactamente una invocación Postman, restauración parcial y IDs cambiados. Fixtures sintéticas no son evidencia CP-12. No hay TDD activo en esta unidad documental.

## Fuentes y alcance

Rutas relativas a la raíz del taller, líneas de fuentes leídas:
- `rabbitmq/worker.mjs:3–25`: demora 3000 ms, received con redelivered, ack antes de processed, noAck=false.
- `rabbitmq/broker.mjs:4–8,11–23`: UTC/instancia y cierre de conexión.
- `rabbitmq/api.mjs:22–38`: UUID, confirm publisher, IDs persistentes y respuesta.
- `rabbitmq/docker-compose.yml:48–61`: dos réplicas, demora, restart policy.
- `rabbitmq/Dockerfile:1–7`: Node 24 Alpine, USER node; launcher real en inspect.
- `rabbitmq/pruebas/RabbitMQ.postman_collection.json:14–58`: item válido y cuatro asserts.
- `evidencias/rabbitmq/consumidores-apagados/herramientas/extract-order-id.mjs:12–49`: reconstrucción y validación UUID desde JSON HTTP.

Cola Management no identifica pedidos: relación inferida solo con aislamiento, logs e ID coincidente. Ausencia de processed es observación acotada, no prueba universal de ausencia de efectos. Objetivo: reentrega y procesamiento observado del mismo pedido sin pérdida en este ensayo; **no exactly-once**, HA ni recuperación del broker. Este diseño por sí solo no acredita el resultado CP-12 ni sustituye capturas. Alternativa demora 60 s descartada: recrea contenedores, cambia IDs y complica restauración.
