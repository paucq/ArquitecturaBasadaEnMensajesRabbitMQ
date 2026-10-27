# Auditoría documental RabbitMQ contra la guía original

> Registro de la auditoría inicial, anterior a consolidar el PDF y validar los scripts. La resolución de sus brechas y las comprobaciones posteriores están en [VERIFICACION_ENTREGA.md](./VERIFICACION_ENTREGA.md). Los estados descritos abajo corresponden a aquella etapa y no sustituyen el cierre vigente.

## Alcance y resultado

**RabbitMQ: diez reportes completos y evidencia pertinente; no equivale a entrega global terminada ni a PDF consolidado.** No se detectaron campos obligatorios ausentes, enlaces locales rotos ni una exigencia de repetir los diez experimentos con pedidos nuevos.

Base de rutas: carpeta `Taller de Pruebas de Integración/`; `E/` significa `evidencias/rabbitmq/`. Los anclajes `:N` indican líneas comprobadas del archivo, no enlaces web.

Fuente prioritaria: `Taller Pruebas de Integración.pdf`, **24 páginas**, leído directamente mediante extracción Python estándar de streams Flate y mapas ToUnicode, sin instalar dependencias ni escribir temporales. Se contrastaron las 24 páginas con `/tmp/taller-integracion-completo.txt`: contenido coherente; 16 coincidencias exactas ignorando espacios, ocho diferencias tipográficas/de extracción, sin glifos desconocidos en la extracción final. No hubo renderizado visual de los diagramas del PDF: su equivalencia funcional se contrasta con las responsabilidades textuales de pp. 7–11, no se certifica identidad gráfica.

Se leyeron los diez reportes completos, fuentes originales seleccionadas y las siete PNG referenciadas distintas. Comprobación pasiva: **138 referencias locales, todas existentes**. No demuestra publicación remota ni portabilidad de todo el código. CodeGraph no indexaba RabbitMQ (`query` sin resultados); se recurrió a lectura acotada. No se ejecutó aplicación, Docker, Postman ni solicitudes.

## Matriz

| Requisito y cita breve | Guía | Artefacto comprobado | Estado documental |
|---|---|---|---|
| «Cada componente… de forma independiente»; Docker obligatorio | p. 3; pp. 8, 11 | `E/verificacion-inicial/compose-ps.txt:2–5`; `rabbitmq/api.mjs:14–35`; `rabbitmq/worker.mjs:9–27` | Satisfecho: API, broker, dos workers; no monolito |
| Contenedores, puertos, consola, «Logs de arranque» | p. 3; pp. 10–11 | `compose-ps.txt:2–5` anterior; `E/verificacion-inicial/compose-logs.txt:1,28,262`; PNG Management pendiente/final en CP-11 | Evidencia disponible: 3000/5672/15672; UI y arranque, no estado live actual |
| POST /orders, JSON, identificador, publicación y aceptación | pp. 8–9, 12 | `E/casos-funcionales/reporteCP01.md:7–15`, CP-02 `:12–16`, CP-03 `:12–16` | CP-01/02/03 satisfechos; HTTP CLI, cola y procesamiento |
| CP-06: mismo ID «API, el broker y el consumidor» | p. 4 | `E/casos-funcionales/reporteCP06.md:15–18`; `E/trazabilidad/corrida-01/broker-native-original.jsonl:1–2` | Satisfecho: traza nativa con IDs y payload, no solo contadores |
| CP-07: «sin esperar al consumidor» | p. 4 | `E/responsive/reporteCP07.md:14–22` | Satisfecho con workers ausentes; 27 ms observado, no SLA |
| CP-08: «No existe comunicación directa» | p. 4; p. 8 | `E/message-driven/reporteCP08.md:13–17`; API/worker inspeccionados; traza CP-06 | Satisfecho en flujo inspeccionado, mediado por broker |
| CP-09: «soporta caída del consumidor» | p. 4 | `E/resilient/reporteCP09.md:9–21` | Satisfecho mediante indisponibilidad controlada; API continúa y pedido se procesa después |
| CP-10: «Distribución de carga» | p. 4; pp. 5, 13 | `E/reparto-carga/reporteCP10.md:13–17`, `tabla.json`, PNG de ambos workers | Satisfecho: seis IDs, reparto 3/3; no prueba escalabilidad lineal |
| CP-11: publicados apagado, procesados al iniciar | p. 4; pp. 5, 13 | `E/consumidores-apagados/corrida-03/reporteCP11.md:14–21` | Satisfecho: 0→1→0, mismo pedido, sin nueva publicación |
| CP-12: «consumidor o el broker», pendientes sin pérdida | p. 4 | `E/recuperacion/reporteCP12.md:9–21`; `corrida-01/final-logs-9daaf02d21e3.txt:1–4` | Satisfecho para un reinicio abrupto de worker; reentrega true y procesamiento; no exige ambos tipos de reinicio |
| Once campos por caso, «Evidencia (capturas)» | p. 4 §7 | Diez reportes anteriores, todos con ID, arquitectura, objetivo, precondiciones, entrada, pasos, esperado, obtenido, capturas, estado y análisis | 10/10 completos; capturas presentes y legibles |
| «Documento PDF»; pruebas, capturas, logs y repo o ZIP | p. 5 §11; p. 13 | Reportes distribuidos y `rabbitmq/README.md`; consolidado pendiente según alcance recibido | **Pendiente de integración de entrega**, no falla experimental |
| Tres preguntas de conclusiones | p. 5 §10 | Análisis individuales disponibles; conclusión global no consolidada | RabbitMQ: redactar síntesis y dificultades; comparación experimental exige Kafka |

## Interpretación sin requisitos inventados

Nombre apropiado: **arquitectura basada en mensajes con RabbitMQ**, evaluada mediante propiedades reactivas (p. 1); Message-driven es una propiedad, no otra tecnología obligatoria. Flujo funcional: cliente HTTP → orders-api → RabbitMQ/cola pedidos → notification-worker; ack manual y prefetch(1) en worker (p. 11). **Python no es obligatorio**: p. 8 permite «Node.js, Java, Python, C#, Go u otro lenguaje». CP-04/05 corresponden solo a Kafka; RabbitMQ tiene diez casos, Kafka otros diez por la distribución de p. 4.

No se exige SLA de latencia, reparto exactamente igual, seis pedidos, exactly-once, deduplicación, prueba de fallo de broker además de worker, captura GUI de Postman ni publicación cloud. Repo **o ZIP** son alternativas (p. 5), no necesariamente repositorio público. No se verificó el remoto.

Las PNG de Management y Docker Desktop son capturas de interfaces; la HTTP es salida Postman CLI guardada. CP-06 y CP-12 son capturas de **vistas derivadas**, no del JSONL original ni de GUI. Sus fuentes se conservan y concuerdan con lo observado; no deben cambiarse títulos, recortarse leyendas para ocultar procedencia ni presentarse como evidencia nativa. La leyenda histórica «PENDIENTE» en CP-12 está explicada en `reporteCP12.md:15–16`.

IDs separados correctamente: b7a… para CP-01/02/03/07/09/11; 8d48… para CP-06/08; seis IDs del lote CP-10; ea298… para CP-12. La reutilización está declarada. No se encontró conclusión general de ausencia de pérdida o exactly-once en los reportes actuales.

## Brechas reales y corrección propuesta, sin aplicarla

**P1 — Consolidación de entrega:** falta presentar el material como informe PDF verificable, requisito de p. 5. Preparar una entrega parcial RabbitMQ explícita, sin llamarla entrega global final. Incorporar los diez reportes con sus once campos, no solo enlaces; capturas legibles y leyendas/procedencia, registros verificables y referencias accesibles, montaje/puertos/arranque, arquitectura y límites; enlace real al código y Compose o ZIP. Validar el PDF exportado: imágenes, páginas, legibilidad y enlaces. No se certifica aquí ese PDF ni la publicación.

**P2 — Referencia de estado desactualizada:** `E/resilient/reporteCP09.md:21` dice «CP-12 sigue pendiente», contradicho por `E/recuperacion/reporteCP12.md:16`. Proponer una nota fechada de actualización o aclaración de estado histórico, preservando originales. Los pendientes históricos de `verificacion-inicial/RESUMEN.md` también necesitan contexto en el índice consolidado, no reescritura silenciosa.

**P2 — Reproducibilidad Windows solicitada por el usuario, no requisito adicional de la guía:** `rabbitmq/README.md` usa ejemplos Bash (`curl` con barras de continuación). Falta una ruta PowerShell inequívoca y validada; no afirmar que el runner o todo el código son portables. El futuro README debe incluir prerrequisitos/versiones verificadas, ubicación inicial, arranque/estado, request JSON compatible, importación Postman, observación Management/logs, precauciones con dos workers y volumen, índice de casos/evidencias y límites de pruebas históricas frente a nuevas ejecuciones.

## Qué consolidar y qué reservar

En el informe RabbitMQ: objetivo/alcance parcial; diagrama funcional propio basado en Anexo 1; entorno y evidencia; diez casos; análisis de asincronía, broker, reparto, caída y recuperación; dificultades documentadas (instrumentación/intentos previos), límites y fuentes con páginas. README e informe pueden complementarse, pero el README **no sustituye el PDF**.

Responder ya «¿Qué dificultades se presentaron en pruebas?» con hechos documentados de RabbitMQ. Para «¿Qué arquitectura es más robusta desde QA?» y «¿Qué diferencias reales se evidenciaron?», declarar comparación experimental pendiente de Kafka; no inventar resultados. La entrega global requiere Kafka, sus diez reportes, comparación sustentada y PDF conjunto conforme a p. 5; no son diez brechas RabbitMQ.

Orden propuesto: aclarar estado histórico → organizar README e informe parcial → comprobar reproducibilidad PowerShell autorizada → exportar/revisar PDF → verificar acceso a repo o ZIP. No requiere nuevas licencias ni publicar el PDF original del profesor: citar título, páginas y secciones basta para esta trazabilidad.
