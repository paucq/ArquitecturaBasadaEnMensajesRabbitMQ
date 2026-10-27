# Verificación de la entrega RabbitMQ

La entrega corresponde **solo a RabbitMQ: diez reportes documentados con once campos y capturas**. Kafka, sus diez casos y la comparación experimental global no se presentan como realizados.

## Contraste con la guía

Se contrastaron las 24 páginas de *Taller Pruebas de Integración*: casos/formato p. 4, conclusiones/entrega p. 5 y Anexo 1 RabbitMQ pp. 7–13. La [auditoría inicial](AUDITORIA_GUIA_INICIAL.md) registró diez reportes completos, 138 referencias existentes y siete capturas distintas. Sus hallazgos describen el estado anterior a la consolidación, no pendientes actuales por sí mismos.

Se aclaró la referencia desactualizada de CP-09: su corrida no acredita recuperación en vuelo, pero CP-12 se completó después con otro pedido y está enlazado. No se alteraron logs, capturas o resultados para atribuir esa recuperación a una prueba diferente.

| Comprobación | Resultado |
| --- | --- |
| Casos RabbitMQ | CP-01/02/03/06/07/08/09/10/11/12: Cumple como conclusión propia, no calificación del profesor |
| Campos y evidencia | Once campos por caso, fuentes originales y capturas pertinentes; vistas derivadas identificadas |
| Código y contenedores | API, broker y dos workers independientes; publicación/consumo AMQP, ack manual y prefetch 1 |
| Recuperación | Mismo ID recibido sin confirmar, reentregado con redelivered=true y procesado; no exactly-once general |
| Informe consolidado | PDF de 27 páginas: diez casos con once campos, siete imágenes originales idénticas píxel a píxel, 169 enlaces HTTP portables y cero páginas vacías; render y revisión visual completados |

## Informe y revisión visual

[PDF de entrega](../../entrega/Informe_RabbitMQ.pdf), [fuente Markdown](INFORME_RABBITMQ.md), [comprobación de compilación](validation-generacion.json) y [cierre visual con SHA-256](verificacion-visual.json). La suite del generador pasó **12/12 tests** y se reconstruyó desde la raíz del clon, sin dependencias absolutas del semestre.

Se renderizaron las 27 páginas a 110 dpi y se revisaron sus hojas de contacto; adicionalmente se inspeccionaron páginas completas de código, aceptación HTTP, logs de Docker Desktop y recuperación CP-12. No se observaron recortes ni solapamientos con el pie. Las capturas mantienen resolución original y enlaces a sus PNG; los detalles de logs GUI pueden consultarse con zoom. El diagrama de la guía p. 7 se contrastó visualmente: API, broker y consumidores separados, con segundo consumidor para escalado. El diagrama del informe es propio, no una captura de ejecución.

La compilación registra la revisión visual como pendiente porque precede al render; su cierre posterior está en el registro independiente enlazado, no se falsifica aquel resultado. Se corrigió una etiqueta del primer borrador que confundía Docker con Node 24; la versión final distingue Docker Engine 29.6.2, Node host 26.8.1 y Node 24 en contenedores. Los registros iniciales se conservan como historial de preparación.

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

Se copiaron **1045 archivos originales de evidencia byte a byte**, incluidos intentos fallidos y cierres posteriores. El [manifest SHA-256](MANIFEST_EVIDENCIAS.sha256) permite contrastarlos. Los finales de línea de evidencias y PDF no se normalizan; los scripts PowerShell tienen política CRLF y el código LF mediante `.gitattributes`.

La [revisión inicial de contenido](revision-publicacion-inicial.json) comprobó 1102 archivos: sin nombres inválidos para Windows, piezas de más de 40 MiB ni coincidencias con los patrones de claves privadas/tokens examinados. Un escaneo por patrones no prueba ausencia de todo secreto. `admin/admin` y su Basic auth son credenciales **del laboratorio local** documentadas, no credenciales personales; los puertos se limitan a loopback.

`.gitignore` excluye node_modules, entornos virtuales, cachés y configuración privada; no oculta globalmente txt/json/png/log de evidencia. No se redistribuye el PDF original del profesor ni se añade una licencia o autores no confirmados.

Destino autorizado: https://github.com/paucq/ArquitecturaBasadaEnMensajesRabbitMQ. Se conserva su commit inicial; no se utiliza force push. La comprobación del remoto y el contenido Git definitivo se realiza después de cerrar las verificaciones locales.
