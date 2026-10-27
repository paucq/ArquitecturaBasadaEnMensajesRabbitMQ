# Aplicación RabbitMQ

La entrada única para ejecutar esta entrega en **Windows PowerShell sin WSL** es el [README principal](../README.md). Instalación, pruebas y diagnóstico: [guía Windows](../docs/EJECUCION_WINDOWS.md). Arquitectura y diez reportes: [mapa RabbitMQ](../docs/ARQUITECTURA_RABBITMQ.md).

No ejecutar comandos Bash de evidencias históricas como instrucciones actuales. Desde la raíz del repositorio se usan `scripts/windows/Start-Lab.ps1`, `Test-Lab.ps1` y `Stop-Lab.ps1`.

Compose inicia cuatro contenedores: API Express, RabbitMQ y dos réplicas de `notification-worker`. API: puerto 3000; Management: 15672; AMQP: 5672 (todos configurables en los scripts y limitados a loopback). Credenciales `admin/admin`: solo laboratorio. `AMQP_URL` conecta internamente con `rabbitmq:5672`; cola constante `pedidos`; demora simulada 3000 ms.

La API devuelve 202 al confirmar publicación en el broker, no al terminar el worker. El ack es manual después del procesamiento. La reentrega es posible; no hay garantía de exactamente una vez.

El runner original contiene dos tests y requiere Docker CLI y Node.js en el host; el Dockerfile no incluye las pruebas ni Docker CLI. No usar `docker compose exec orders-api npm test`. Ver la guía principal para el runner correcto y los parámetros de aislamiento. Los dos tests no sustituyen los diez casos de entrega.
