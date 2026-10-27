# CP-10 — Elastic — RabbitMQ

- **ID del caso:** CP-10, corrida reparto-carga, 2026-10-27 UTC.
- **Arquitectura:** RabbitMQ; API → cola pedidos → dos instancias notification-worker.
- **Objetivo:** demostrar reparto real del lote entre ambas instancias ya activas.
- **Precondiciones:** dos workers running; API y broker healthy; Consumers=2, Ready=0, Unacked=0, Total=0. [Estado inicial](02-management-stdout.txt), [Compose](01-compose-stdout.txt).
- **Datos de entrada:** seis POST válidos con Pedro, Libro de arquitectura, quantity=1. Seis es parámetro del laboratorio, no exigencia del profesor.
- **Pasos ejecutados:**
  1. Guardar Compose y Management; validar precondición sin modificar servicios.
  2. Ejecutar una sola corrida Postman de seis iteraciones del request válido, sin --output ni login.
  3. Esperar hasta 60 s los seis procesamientos y cola vacía con dos consumidores; preservar logs originales antes de derivar resultados.
  4. Relacionar IDs y guardar estado final. [Comandos y tabla](RESUMEN.md).
- **Resultado esperado:** seis respuestas accepted con IDs únicos; 24 aserciones correctas; cada pedido publicado, recibido y procesado, con al menos uno procesado por cada worker.
- **Resultado obtenido:** 6 IDs únicos, 4 × 6 = 24/24 aserciones, todos correlacionados; worker-1 procesó 3 y worker-2 procesó 3. Ready=0, Unacked=0, Total=0, Consumers=2 al cierre. [Resultado](resultado.json), [tabla](tabla.json).
- **Evidencia (capturas):** capturas reales de Docker Desktop Logs: [worker-1](docker-logs-worker-1.png), instancia `9daaf02d21e3`, muestra tres `order_processed` para IDs `962eb263`, `fbd6453d`, `e3d243ec`; [worker-2](docker-logs-worker-2.png), instancia `aea9d0d7aa00`, muestra tres para `d047fa00`, `f83a6ad1`, `462f5dc3` (fragmentos de los UUID completos de la [tabla](tabla.json)). Corresponden al lote del 2026-10-27, 01:58:33–43 UTC, y demuestran directamente reparto entre ambas instancias. Complementan [HTTP original](03-postman-stdout.txt), [logs nativos](05-logs-stdout.txt), [Management final JSON](06-management-final-stdout.txt) y [Compose final](07-compose-final-stdout.txt); estos últimos son evidencia CLI, no capturas GUI. No se requiere una captura GUI adicional de cola para esta conclusión.
- **Estado:** Cumple
- **Análisis técnico:** «Cumple» es la conclusión de nuestro reporte, no una calificación del profesor. El reparto se observa en dos instancias distintas, con los seis IDs aceptados presentes en procesamiento. No se observaron IDs perdidos en este lote; esto no prueba ausencia general de pérdida ni exactly-once. El 3/3 no es requisito; no se midió escalabilidad lineal ni se comparó una contra dos instancias. No se ejecutaron caídas, reinicios, recuperación ni Kafka; aplicación y Compose permanecen sin modificaciones.
