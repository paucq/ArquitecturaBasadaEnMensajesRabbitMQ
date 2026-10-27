# CP-12 RabbitMQ — cierre técnico y visual: Cumple

[Reporte de 11 campos](reporteCP12.md) · [Vista derivada para captura real](corrida-01/VISTA_EVIDENCIAS.txt).

Única corrida nueva: `ORD-ea298437-f581-4b8f-b80d-2706f3659b80`. [recovery.json](corrida-01/recovery.json) permanece intacto: TECHNICALLY_VERIFIED_VISUAL_PENDING, publishedInvocations=1, cleanup=[], finished=2026-10-27T03:46:53.157Z. cleanup=[] registra ausencia de acciones de emergencia, no ausencia de restauración: target y peer se iniciaron normalmente (104/117). El padre informó job 1 exitcode 0 en ~51 s; los datos siguientes se contrastan con originales, no solo ese resumen.

## Secuencia y snapshots

| Etapa (UTC 2026-10-27) | Ready/Unacked/Total/Consumers | Fuente original |
| --- | --- | --- |
| Baseline, GET 008 | 0/0/0/2 | [baseline](corrida-01/baseline-queue.json), [008](corrida-01/008.get.json) |
| Peer detenido, GET 025 | 0/0/0/1 | [peer-stopped](corrida-01/peer-stopped-queue.json), [025](corrida-01/025.get.json) |
| 03:46:32.993–33.003, target suspendido | 0/1/1/1 | [before-fault](corrida-01/before-fault-queue.json), [061](corrida-01/061.get.json) |
| 03:46:42.944, antes de start | 1/0/1/0 | [after-fault](corrida-01/after-fault-queue.json), [103](corrida-01/103.get.json) |
| 03:46:52.947, final GET 165 | 0/0/0/2 | [final](corrida-01/final.json), [165](corrida-01/165.get.json) |

API order_published **03:46:24.255Z** ([raw API](corrida-01/final-logs-28a4ac996bc2.txt)); HTTP 202/**71 ms**, 1 request y 4/4 assertions ([stdout](corrida-01/027.stdout.txt)). Worker-1 recibe **03:46:24.274Z**, redelivered=false; tras restart del mismo contenedor recibe **03:46:45.109Z**, redelivered=true y procesa **03:46:48.123Z**, intervalo **3.014 s** ([raw worker](corrida-01/final-logs-9daaf02d21e3.txt)). [Peer](corrida-01/final-logs-aea9d0d7aa00.txt) registra worker_ready, no procesamiento de este ID.

## Comandos originales: no ejecutarlos para capturar

Los vectores argv, relojes monotónicos, timeouts y stdout/stderr individuales están conservados en corrida-01. Números enlazan metadatos; cada uno tiene su archivo NNN.stdout.txt/NNN.stderr.txt. Tabla de mutaciones y publicación, no lista exhaustiva de lecturas; [intent.jsonl](corrida-01/intent.jsonl) enumera todas las intenciones.

| Registro | argv exacto | Inicio → fin UTC | Duración ms | exitcode |
| --- | --- | --- | --- | --- |
| [009](corrida-01/009.command.json) | `docker stop --timeout 10 aea9d0d7aa0048044777558fc51b45495452dbfe31c4b334536eb498d53837f7` | 2026-10-27T03:46:02.924Z → 2026-10-27T03:46:14.012Z | 11091.434 | 0 |
| [027](corrida-01/027.command.json) | `postman collection run /home/juandav12/projects/8thSemester/Aseguramiento_de_Calidad/Talleres/Taller de Pruebas de Integración/rabbitmq/pruebas/RabbitMQ.postman_collection.json -i Crear pedido — esperado HTTP 202 --no-report-events --verbose --timeout 30000 --timeout-request 10000 --timeout-script 5000` | 2026-10-27T03:46:18.057Z → 2026-10-27T03:46:24.872Z | 6815.644 | 0 |
| [028](corrida-01/028.command.json) | `docker kill --signal SIGSTOP 9daaf02d21e371996a271e5593f53808da530dc096c7a372c9b4e6b1db568437` | 2026-10-27T03:46:24.289Z → 2026-10-27T03:46:24.439Z | 149.828 | 0 |
| [064](corrida-01/064.command.json) | `docker stop --signal SIGKILL --timeout 0 9daaf02d21e371996a271e5593f53808da530dc096c7a372c9b4e6b1db568437` | 2026-10-27T03:46:33.178Z → 2026-10-27T03:46:33.629Z | 451.215 | 0 |
| [104](corrida-01/104.command.json) | `docker start 9daaf02d21e371996a271e5593f53808da530dc096c7a372c9b4e6b1db568437` | 2026-10-27T03:46:42.958Z → 2026-10-27T03:46:44.633Z | 1675.357 | 0 |
| [117](corrida-01/117.command.json) | `docker start aea9d0d7aa0048044777558fc51b45495452dbfe31c4b334536eb498d53837f7` | 2026-10-27T03:46:48.284Z → 2026-10-27T03:46:48.821Z | 537.410 | 0 |

SIGSTOP no es Docker pause. Target terminado a 03:46:33.275779871Z, ExitCode=137/OOMKilled=false; ambos workers exited antes del start ([after-stop](corrida-01/after-stop-containers.json)). No confundir exitcode 0 de Docker con exitcode 137 del contenedor. Se usó stop/start, no docker restart ni recuperación automática por restart policy. unless-stopped se conservó. No se requirió SIGCONT tras matar/reiniciar PID1.

## Identidad y restauración

- /qa-taller-integracion-rabbitmq-orders-api-1: `28a4ac996bc208f15467744cbcdd14d834b7c8e3e8aee1e7fc4a80127e2e65ec`
- /qa-taller-integracion-rabbitmq-rabbitmq-1: `874ff8f0d7a79f21b3f428964f70316be1e87b00fa4cd58e5a51eefe0fb41ab0`
- /qa-taller-integracion-rabbitmq-notification-worker-1: `9daaf02d21e371996a271e5593f53808da530dc096c7a372c9b4e6b1db568437`
- /qa-taller-integracion-rabbitmq-notification-worker-2: `aea9d0d7aa0048044777558fc51b45495452dbfe31c4b334536eb498d53837f7`

[Originales](corrida-01/original-containers.json) y [final](corrida-01/final.json) conservan los cuatro IDs; dos workers running/no paused, API/broker healthy, health ready, pedidos durable/Consumers=2 y Ready=Unacked=Total=0. No recreación ni cambios de código/Compose/colección en esta unidad documental.

## Pruebas offline y límites

[Preparación offline preservada](offline/RESUMEN.md): selector RED exitcode 1 (7 pasan/1 falla), selector GREEN exitcode 0 (8/8), syntax exitcode 0; execution-guard exitcode 2 esperado sin carpeta nueva. Flags --execute-ack-recovery y rechazo de corrida existente protegen la ejecución; no se invocó el helper aquí. Son pruebas del helper, no prueba runtime del pedido. TDD no activo en esta unidad documental. LSP previo inconcluso por servidores silenciosos; no se declara validación LSP completa de Markdown.

La suspensión SIGSTOP de PID1 fue instrumentación breve, no mensaje confirmado ni caída del broker. El gate Unacked terminó 8.714 s después de la intención STOP (03:46:24.289→03:46:33.003), dentro de 12 s; la orden SIGKILL empezó a los 8.889 s. No es una garantía temporal general. La parada fue manual/controlada en su ejecución, pero abrupta para el proceso (SIGKILL): al desconectarse el consumidor, el broker devuelve el trabajo no confirmado a Ready. No se ensayó recuperación del broker.

Se observan dos entregas y un order_processed del mismo pedido; redelivered=true acredita reentrega, **no exactly-once**. Un trabajo sin confirmar puede haber producido efectos antes del fallo y duplicarlos al reintentarse; estos logs no prueban ausencia universal de efectos ni idempotencia. Sin pérdida observada para este único ID, no garantía general, HA, downtime cero ni benchmark. Management no contiene el orderId: su asociación depende de baseline vacío, una publicación y logs correlacionados. Los contadores acumulados no representan exclusivamente esta corrida.

## Cierre y cobertura vigente

**CP-12 RabbitMQ: Cumple**, conclusión propia, no evaluación del profesor. [Captura real aportada por el usuario y revisada completa por el padre](corrida-01/captura-recuperacion-worker.png), de la vista explícitamente DERIVADA de los originales reales enlazados arriba; no GUI ni log nativo modificado. Mismo `ORD-ea298437-f581-4b8f-b80d-2706f3659b80`, sin reutilizar captura CP-06 ni repetir el ensayo. La leyenda «captura PENDIENTE» en la vista/imagen es histórica: antecede a recibir la foto. VISTA, recovery.json y validación documental anterior se preservan intactos.

**RabbitMQ 10/10**: CP-01/02/03/06/07/08/09/10/11/12 completos; Kafka 0/10, entero pendiente; PDF final pendiente. No hay pendiente visual actual de CP-12. Los pendientes anteriores son etapas históricas. Solo cierre documental, sin operaciones runtime ni modificación de fuentes. [Validación offline del cierre](validacion-cierre.json), separada del registro histórico.
