# Preparación offline del ensayo CP-12

Estos archivos son pruebas del helper y **no constituyen evidencia de recuperación de un pedido real**. El resultado del ensayo, cuando exista, se conserva separadamente en `../corrida-01/`.

## Pruebas conservadas

- `RED.*` / `GREEN.*`: registros originales dejados por la preparación del subagente; no se sobrescriben.
- `selector-RED.json` y sus stdout/stderr: ejecución real con exitcode 1, siete tests aprobados y uno fallido. El comando usaba `--folder`, distinto del selector `-i` ya empleado en las corridas Postman previas.
- `selector-GREEN.json` y sus stdout/stderr: tras corregir el comando y conectar el constructor puro al orquestador, exitcode 0, **8/8 tests aprobados**.
- `syntax.*`: `node --check` del orquestador, exitcode 0.
- `execution-guard.*`: invocación del orquestador sin el parámetro explícito; exitcode **2 esperado** y sin creación de carpeta de corrida. No ejecuta servicios.

La suite comprueba selector de una sola solicitud local sin `--output`, rechazo de publicaciones duplicadas, parser de logs fragmentados, IDs históricos/múltiples, EOF inesperado, correspondencia HTTP/API, gate Unacked y plazo de STOP, rechazo de fallo antes del gate, recepción con redelivered=true antes de processed y ámbito de restauración por IDs/proyecto.

Los fixtures son sintéticos y están identificados como tales en el test. No prueban por sí solos que una señal llegue a Docker ni que el experimento runtime termine correctamente. Para ello se necesitan los comandos y snapshots de la corrida real.

## Precauciones de ejecución

`run-cp12.mjs` exige `--execute-ack-recovery` y rechaza una carpeta `corrida-01` ya existente; no cambia el nombre para repetir un ensayo fallido. El padre ejecuta el intento mediante trabajo en segundo plano porque esa herramienta no estaba disponible para el subagente. **No volver a invocar el helper para capturar pantallas.**

Se conserva intención antes de suspender/detener procesos. La suspensión SIGSTOP es instrumentación reversible; el stop abrupto SIGKILL solo procede después de comprobar HTTP, ID y mensaje sin confirmar. El otro worker se detiene temporalmente con cola vacía. Se deben restaurar ambos IDs originales, sin purga, cambios de aplicación, cambios de Compose ni recreación de contenedores.

El watcher puede cerrarse intencionalmente durante limpieza sin convertir ese cierre en fallo del ensayo. Una vez reiniciado el target, ya no requiere SIGCONT adicional. Los timeouts son fallos, no autorizaciones para publicar de nuevo. SIGKILL del propio orquestador no permite ejecutar finally: por eso se conservan intenciones e instrucciones de recuperación manual para una inspección posterior.

Diagnósticos LSP de los tres archivos JavaScript en la revisión del padre: sin hallazgos publicados, pero resultado **inconcluso** por servidores silenciosos; no se declara limpieza confirmada. La suite y el chequeo sintáctico sí produjeron salidas y códigos verificables.
