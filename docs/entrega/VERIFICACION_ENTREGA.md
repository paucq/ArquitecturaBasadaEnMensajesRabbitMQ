# Verificación de la entrega RabbitMQ

Este repositorio corresponde **a RabbitMQ: diez reportes documentados con once campos y capturas**. La arquitectura Kafka y el informe comparativo global se entregan por separado.

## Contraste con la guía

Se contrastaron las 24 páginas de *Taller Pruebas de Integración*: casos/formato p. 4, conclusiones/entrega p. 5 y Anexo 1 RabbitMQ pp. 7–13. La [auditoría inicial](AUDITORIA_GUIA_INICIAL.md) registró diez reportes completos, 138 referencias existentes y siete capturas distintas. Sus hallazgos describen el estado anterior a la consolidación, no pendientes actuales por sí mismos.

Se aclaró la referencia desactualizada de CP-09: su corrida no acredita recuperación en vuelo, pero CP-12 se completó después con otro pedido y está enlazado. No se alteraron logs, capturas o resultados para atribuir esa recuperación a una prueba diferente.

| Comprobación | Resultado |
| --- | --- |
| Casos RabbitMQ | CP-01/02/03/06/07/08/09/10/11/12: Cumple como conclusión propia, no calificación del profesor |
| Campos y evidencia | Once campos por caso, fuentes originales y capturas pertinentes; vistas derivadas identificadas |
| Código y contenedores | API, broker y dos workers independientes; publicación/consumo AMQP, ack manual y prefetch 1 |
| Recuperación | Mismo ID recibido sin confirmar, reentregado con redelivered=true y procesado; no exactly-once general |
| Informe consolidado | Diez casos con once campos y siete capturas; seis completas y un detalle CP-12 identificado. La comprobación de compilación registra páginas, enlaces portables y coincidencia de píxeles con las fuentes |

## Informe y revisión visual

[PDF de entrega](../../entrega/Informe_RabbitMQ.pdf), [fuente Markdown](INFORME_RABBITMQ.md), [comprobación de compilación](validation-generacion.json) y [revisión visual con SHA-256](verificacion-visual.json). La suite del generador pasó **15/15 tests**. El informe contiene 27 páginas y diez casos con once campos.

La versión actual pasó el control geométrico de texto de las 27 páginas. Se inspeccionó la página 27 a escala 1,5 para comprobar el detalle CP-12: sin cortes de registros ni solapamientos con el pie. Se verificó además la coincidencia de píxeles de seis imágenes completas y del detalle recortado con sus fuentes. Los originales completos permanecen enlazados; los detalles de logs GUI pueden consultarse con zoom. Esta revisión muestral no equivale a una lectura visual exhaustiva de todas las figuras.

El registro enlazado identifica por SHA-256 el PDF revisado. Docker Engine 29.6.2, Node host 26.8.1 y Node 24 en contenedores se distinguen en la documentación. Los registros de preparación conservan las condiciones y resultados de sus ejecuciones originales.

## Comprobación funcional desde PowerShell

Fecha: 2026-10-27 UTC. Se ejecutaron los mismos scripts incluidos en el repositorio, sin shims de npm ni simulación de Docker, en un proyecto aislado:

- PowerShell 7.6.9 portable sobre **Linux/WSL2**, Docker Desktop/Engine 29.6.2; runner Node.js 26.8.1 y aplicación en imagen Node 24.
- Proyecto `qa-rabbitmq-entrega-verificacion`, API 3300, Management 15673 y AMQP 5673. No se reutilizaron datos ni contenedores de ese proyecto.
- `Start-Lab.ps1`: exitcode 0, comprobación de cuatro contenedores y dos workers, API ready.
- `Test-Lab.ps1`: exitcode 0, **2/2 tests aprobados**, ninguno fallido; `npm ci` informó cero vulnerabilidades en esa ejecución. No es garantía permanente de ausencia de vulnerabilidades.
- `Stop-Lab.ps1`: exitcode 0, proyecto aislado sin contenedores restantes; su volumen se conservó al no usar `-v`.
- Los cuatro IDs del proyecto histórico `qa-taller-integracion-rabbitmq` permanecieron iguales y running. Los pedidos nuevos de esta comprobación no se mezclaron con las evidencias de los diez casos.

[Resultado y plataforma](verificacion-powershell/resultado.json), [salida de pruebas](verificacion-powershell/Test-Lab.stdout.txt) y [metadatos del comando](verificacion-powershell/Test-Lab.command.json). Los demás stdout/stderr y códigos de cada etapa están en esa misma carpeta.

El parser de PowerShell 7.6.9 informó cero errores en los tres scripts: [registro](verificacion-powershell/parser.stdout.txt). La selección npm.cmd fija produjo exitcode 1 en Linux; se hizo explícita la selección npm.cmd en Windows con fallback npm y la comprobación pasó con exitcode 0. Los registros RED/GREEN de esa mejora no son fallos de los experimentos RabbitMQ ni una prueba de Windows nativo.

**Límite importante:** no se dispuso de una máquina Windows/Hyper-V. No se certifica ejecución nativa de Windows PowerShell 5.1 ni Hyper-V. Los scripts evitan sintaxis exclusiva de PS7 y la [guía Windows](../EJECUCION_WINDOWS.md) describe la ruta Hyper-V sin WSL, pero la plataforma efectivamente usada para verificarlos es la indicada arriba. No presentar capturas históricas WSL como validación Windows.

## Integridad y publicación

El [manifiesto SHA-256 de evidencia](MANIFEST_EVIDENCIAS.sha256) registra los **1045 archivos** de la versión de entrega, incluidos intentos fallidos y cierres posteriores. Se actualizó tras las correcciones editoriales de los reportes Markdown; los logs, JSON y capturas originales permanecen byte a byte intactos. Los finales de línea de evidencias y PDF no se normalizan; los scripts PowerShell tienen política CRLF y el código LF mediante `.gitattributes`.

La [revisión inicial de contenido](revision-publicacion-inicial.json) comprobó 1102 archivos: sin nombres inválidos para Windows, piezas de más de 40 MiB ni coincidencias con los patrones de claves privadas/tokens examinados. Un escaneo por patrones no prueba ausencia de todo secreto. `admin/admin` y su Basic auth son credenciales **del laboratorio local** documentadas, no credenciales personales; los puertos se limitan a loopback.

`.gitignore` excluye node_modules, entornos virtuales, cachés y configuración privada; no oculta globalmente txt/json/png/log de evidencia. No se redistribuye el PDF original del profesor ni se añade una licencia o autores no confirmados.

Repositorio de destino: https://github.com/paucq/ArquitecturaBasadaEnMensajesRabbitMQ. Los enlaces documentales no prueban por sí solos acceso remoto ni publicación verificada.
