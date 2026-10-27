# CP-03 — Consumo de mensaje RabbitMQ — RabbitMQ

- ID del caso: CP-03; revisión documental de corrida 03.
- Arquitectura: RabbitMQ; orders-api → pedidos → notification-worker.
- Objetivo: Validar que el consumidor procesa el mensaje.
- Precondiciones: Pedido de corrida 03 almacenado con workers apagados ([cola pendiente](../consumidores-apagados/corrida-03/cola-final.json)); después se iniciaron ambos sin nueva publicación.
- Datos de entrada: Corrida 03 del 2026-10-27; un POST /orders con JSON `{"customerName":"Pedro","product":"Libro de arquitectura","quantity":1}`. Pedido `ORD-b7a74952-2957-49cb-a5db-f88d7b2ce443`; correlationId igual al orderId.
- Pasos ejecutados:
  1. Se conservó el pendiente.
  2. Se iniciaron los workers una sola vez (registro histórico en el reporte CP-11).
  3. Se guardaron [logs worker-2](../consumidores-apagados/corrida-03/consumo-posterior/logs-mismo-id-notification-worker.txt) y [resultado final](../consumidores-apagados/corrida-03/consumo-posterior/resultado-final.json).
- Resultado esperado: El consumidor recibe y procesa el mensaje pendiente.
- Resultado obtenido: worker-2 / aea9d0d7aa00 registra order_received 2026-10-27T01:46:31.200Z y order_processed 2026-10-27T01:46:34.229Z del mismo ID; duración 3.029 s. Final Ready=0, Unacked=0, Total=0, Consumers=2. [logs worker-2](../consumidores-apagados/corrida-03/consumo-posterior/logs-mismo-id-notification-worker.txt); [resultado final](../consumidores-apagados/corrida-03/consumo-posterior/resultado-final.json).
- Evidencia (capturas): [Docker Desktop Logs worker-2](../reparto-carga/docker-logs-worker-2.png) contiene el ID de esta corrida recibido/procesado a 01:46:31/34, antes del lote CP-10; [Management final](../consumidores-apagados/corrida-03/consumo-posterior/management-pedido-consumido.png) muestra cola 0/0/0 y Consumers=2.
- Estado: Cumple.
- Análisis técnico: Los logs con ID y captura real del worker demuestran procesamiento; la cola final corrobora ausencia de pendientes en este escenario. No se promete exactly-once ni ausencia general de pérdida. No se confunden las tres líneas posteriores por instancia del lote CP-10 con este pedido. Conclusión documental propia, no calificación del profesor. Fuente: guía pp. 4 y 7–13 y [reporte original CP-11](../consumidores-apagados/corrida-03/reporteCP11.md). Sin ejecución live ni modificación de evidencias originales.
