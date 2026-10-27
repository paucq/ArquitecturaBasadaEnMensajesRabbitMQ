# Plan de verificación — entrega RabbitMQ

Esta es la adaptación para el repositorio independiente de RabbitMQ. El plan académico original y sus etapas se conservan en el repositorio del semestre; aquí se documenta el estado vigente de esta arquitectura, sin incluir archivos de otras materias.

**Resultado: 10/10 reportes RabbitMQ completos**, con once campos, registros y capturas. Son conclusiones de los reportes, no una calificación del profesor. La guía exige también Kafka y una comparación: esas partes no están terminadas ni se presentan como realizadas en este repositorio.

## Fuentes y alcance

- Fuente del curso: *Taller Pruebas de Integración*, 24 páginas; casos y formato p. 4, conclusiones/entrega p. 5 y Anexo 1 RabbitMQ pp. 7–13.
- [Auditoría inicial contra la guía](docs/entrega/AUDITORIA_GUIA_INICIAL.md), con trazabilidad de requisitos y limitaciones de la revisión.
- [Arquitectura y mapa de casos](docs/ARQUITECTURA_RABBITMQ.md).
- [Ejecución desde PowerShell Windows](docs/EJECUCION_WINDOWS.md).

No se redistribuye el PDF original del profesor. El informe derivado conserva referencias por página. Las fechas de capturas, logs y resultados corresponden a los experimentos documentados, no a una comprobación live permanente.

## 7. Fase 4 — Ejecutar los casos obligatorios

### 7.1 Matriz de cobertura

Cada casilla representa un reporte separado por arquitectura. Una corrida puede respaldar varios objetivos si se declara la reutilización y se conservan sus fuentes; no se mezclan IDs de experimentos distintos.

| Caso | Criterio verificable | RabbitMQ | Kafka |
| --- | --- | :---: | :---: |
| CP-01 — Creación vía API | POST /orders, entrada, respuesta e ID generado. | [x] | [ ] |
| CP-02 — Envío RabbitMQ | Publicación y mensaje pendiente en pedidos, relacionado con API. | [x] | No aplica |
| CP-03 — Consumo RabbitMQ | Recepción/procesamiento del mismo pedido y estado de cola. | [x] | No aplica |
| CP-04 — Publicación Kafka | Evento en orders.events; fuera del alcance de este repositorio. | No aplica | [ ] |
| CP-05 — Consumo Kafka | Consumidores funcionales y offsets; fuera de este repositorio. | No aplica | [ ] |
| CP-06 — Trazabilidad | Mismo ID en API, registro nativo del broker y consumidor. | [x] | [ ] |
| CP-07 — Responsive | Aceptación HTTP sin esperar el procesamiento del worker. | [x] | [ ] |
| CP-08 — Message-driven | Código/configuración y traza que acreditan mediación por broker. | [x] | [ ] |
| CP-09 — Resilient | Continuidad de aceptación durante indisponibilidad del consumidor. | [x] | [ ] |
| CP-10 — Elastic | Lote e IDs repartidos entre las dos instancias. | [x] | [ ] |
| CP-11 — Desacoplamiento temporal | Publicación sin consumidores y consumo posterior del mismo ID. | [x] | [ ] |
| CP-12 — Recuperación | Interrupción con Unacked, reentrega y procesamiento del mismo ID. | [x] | [ ] |

**Conteo:** RabbitMQ 10/10; Kafka 0/10. El taller completo requiere 20 reportes, no solo estos diez.

### 7.2 Reportes y grupos de evidencia

| Caso | Reporte de once campos | Corrida / pedido |
| --- | --- | --- |
| CP-01 | [Creación vía API](evidencias/rabbitmq/casos-funcionales/reporteCP01.md) | corrida 03, ORD-b7a… |
| CP-02 | [Publicación](evidencias/rabbitmq/casos-funcionales/reporteCP02.md) | corrida 03, ORD-b7a… |
| CP-03 | [Consumo](evidencias/rabbitmq/casos-funcionales/reporteCP03.md) | corrida 03, ORD-b7a… |
| CP-06 | [Trazabilidad](evidencias/rabbitmq/casos-funcionales/reporteCP06.md) | traza 01, ORD-8d48… |
| CP-07 | [Responsive](evidencias/rabbitmq/responsive/reporteCP07.md) | corrida 03, ORD-b7a… |
| CP-08 | [Message-driven](evidencias/rabbitmq/message-driven/reporteCP08.md) | traza 01, ORD-8d48… |
| CP-09 | [Resilient](evidencias/rabbitmq/resilient/reporteCP09.md) | corrida 03, ORD-b7a… |
| CP-10 | [Elastic](evidencias/rabbitmq/reparto-carga/reporteCP10.md) | lote de seis IDs; tres por worker |
| CP-11 | [Desacoplamiento temporal](evidencias/rabbitmq/consumidores-apagados/corrida-03/reporteCP11.md) | corrida 03, ORD-b7a… |
| CP-12 | [Recuperación](evidencias/rabbitmq/recuperacion/reporteCP12.md) | recuperación 01, ORD-ea298… |

Los IDs completos, timestamps y fuentes están en cada reporte. Los intentos fallidos originales permanecen documentados; no se ocultan ni se confunden con las corridas satisfactorias.

### 7.3 Límites de interpretación

- Las capturas de vistas derivadas CP-06/12 están identificadas y enlazan sus registros originales. No son GUI del broker ni logs nativos nuevos.
- Los estados «pendiente» en archivos históricos describen su momento de creación; los cierres posteriores se acreditan en los reportes e índices actuales.
- Los 27 ms, el reparto 3/3 y los intervalos de procesamiento son resultados observados, no SLA, requisitos inventados ni garantías de escalabilidad.
- Reentrega y procesamiento no equivalen a exactly-once, idempotencia, alta disponibilidad o ausencia universal de pérdida.
- CP-12 prueba recuperación de un worker interrumpido antes del ack; no se ensayó caída del broker ni se exige duplicar ambos reinicios en la guía.
- Los helpers de instrumentación en evidencias son históricos: sus guardas, IDs, proyectos y validadores registran aquella ejecución. No son el inicio rápido de otra máquina. Para una corrida nueva se usa la guía PowerShell y se genera evidencia nueva.

### 7.4 Formato obligatorio

Cada reporte contiene ID, arquitectura, objetivo, precondiciones, datos de entrada, pasos, resultado esperado, resultado obtenido, evidencia (capturas), estado y análisis técnico.

## Entrega y reproducción

El repositorio conserva código, Compose, colección Postman, reportes y evidencias. Las instrucciones principales usan PowerShell; el montaje arranca API, RabbitMQ y dos workers por defecto. No necesita Ubuntu ni una shell WSL. La opción estrictamente sin backend WSL usa Docker Desktop con Hyper-V en una edición Windows compatible, manteniendo **Linux containers**.

La validación disponible se distingue de una ejecución nativa Windows/Hyper-V; los registros de comprobación indican plataforma, comandos y códigos reales. El informe PDF corresponde solo a RabbitMQ; el PDF global y la comparación con Kafka requieren completar la segunda arquitectura.
