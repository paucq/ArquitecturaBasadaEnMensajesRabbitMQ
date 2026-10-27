# CP-01 — Creación de pedido vía API — RabbitMQ

- ID del caso: CP-01; revisión documental de corrida 03.
- Arquitectura: RabbitMQ; orders-api → pedidos → notification-worker.
- Objetivo: Validar que el endpoint recibe y responde correctamente.
- Precondiciones: API y broker disponibles; workers apagados. [baseline](../consumidores-apagados/corrida-03/baseline.json).
- Datos de entrada: Corrida 03 del 2026-10-27; un POST /orders con JSON `{"customerName":"Pedro","product":"Libro de arquitectura","quantity":1}`. Pedido `ORD-b7a74952-2957-49cb-a5db-f88d7b2ce443`; correlationId igual al orderId.
- Pasos ejecutados:
  1. Se envió una sola solicitud válida mediante Postman CLI ([request y respuesta CLI](../consumidores-apagados/corrida-03/06-postman-stdout.txt)).
  2. Se conservaron respuesta, ID y aserciones; revisión actual exclusivamente offline.
- Resultado esperado: Endpoint recibe JSON y responde aceptación con orderId.
- Resultado obtenido: HTTP 202 Accepted, 27 ms, status accepted, mensaje «Pedido recibido y enviado a RabbitMQ», ID indicado; 4/4 aserciones y una request. [request y respuesta CLI](../consumidores-apagados/corrida-03/06-postman-stdout.txt).
- Evidencia (capturas): [Captura real de Postman CLI](postman-cli-pedido-aceptado.png), aportada por el usuario: muestra POST localhost:3000/orders, datos de Pedro, HTTP 202 Accepted, 27 ms, status accepted, mensaje esperado y el orderId completo indicado, partido visualmente en líneas. Es una captura de la salida CLI original guardada de corrida 03, no de la GUI de Postman ni de una corrida nueva; se contrasta con el [stdout original](../consumidores-apagados/corrida-03/06-postman-stdout.txt). [Management pendiente](../consumidores-apagados/corrida-03/management-pedido-pendiente.png) acredita almacenamiento posterior, no request/respuesta HTTP.
- Estado: Cumple.
- Análisis técnico: Solicitud, respuesta y captura real de la salida CLI guardada respaldan la aceptación HTTP del mismo pedido de corrida 03. No se afirma una captura GUI de Postman ni una ejecución nueva. No se ha observado un defecto de API. Conclusión documental propia, no calificación del profesor. Fuente: guía pp. 4 y 7–13 y [reporte original CP-11](../consumidores-apagados/corrida-03/reporteCP11.md). Sin ejecución live ni modificación de evidencias originales.
