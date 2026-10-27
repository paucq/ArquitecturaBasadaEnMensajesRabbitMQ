# CP-02 — Envío de mensaje a RabbitMQ — RabbitMQ

- ID del caso: CP-02; revisión documental de corrida 03.
- Arquitectura: RabbitMQ; orders-api → pedidos → notification-worker.
- Objetivo: Verificar que el pedido genera un mensaje en la cola.
- Precondiciones: API/broker disponibles; ambos workers apagados, Consumers=0 y cola vacía: [baseline](../consumidores-apagados/corrida-03/baseline.json).
- Datos de entrada: Corrida 03 del 2026-10-27; un POST /orders con JSON `{"customerName":"Pedro","product":"Libro de arquitectura","quantity":1}`. Pedido `ORD-b7a74952-2957-49cb-a5db-f88d7b2ce443`; correlationId igual al orderId.
- Pasos ejecutados:
  1. Se verificó baseline vacío.
  2. Se publicó un único pedido ([request y respuesta CLI](../consumidores-apagados/corrida-03/06-postman-stdout.txt)).
  3. Se conservaron [log API](../consumidores-apagados/corrida-03/logs-mismo-id.txt), [cola pendiente](../consumidores-apagados/corrida-03/cola-final.json) y captura con el pendiente.
- Resultado esperado: El pedido genera un mensaje en pedidos.
- Resultado obtenido: order_published a 2026-10-27T01:39:39.627Z, queue pedidos, mismo ID. Ready 0 → 1, Unacked=0, Total=1, Consumers=0; durable=true. [log API](../consumidores-apagados/corrida-03/logs-mismo-id.txt); [cola pendiente](../consumidores-apagados/corrida-03/cola-final.json).
- Evidencia (capturas): [Management pendiente](../consumidores-apagados/corrida-03/management-pedido-pendiente.png): Ready=1, Unacked=0, Total=1, Consumers=0, Persistent=1, durable=true. No muestra ID ni payload.
- Estado: Cumple.
- Análisis técnico: Baseline vacío, publicación única y aumento de un mensaje con cero consumidores respaldan el envío a cola exigido por CP-02. No se inspeccionó payload ni se usó Get messages. Esta correlación experimental no sustituye el log del broker por ID exigido en CP-06. Conclusión documental propia, no calificación del profesor. Fuente: guía pp. 4 y 7–13 y [reporte original CP-11](../consumidores-apagados/corrida-03/reporteCP11.md). Sin ejecución live ni modificación de evidencias originales.
