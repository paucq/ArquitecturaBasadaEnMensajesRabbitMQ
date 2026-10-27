# Corrección offline del extractor

Sin Docker, Postman, red, publicación ni cambios en fixtures originales. Herramienta Node.js sin dependencias externas; no cambia aplicación, Compose o colección.

## Descubrimiento verificado

Postman CLI envuelve visualmente el cuerpo HTTP JSON incluso dentro de UUIDs y palabras. Buscar UUID directamente en stdout fallaba aunque la API hubiera devuelto HTTP 202 correctamente. Ambas corridas Postman originales tuvieron exitcode 0: este defecto pertenece a la instrumentación, no a la API.

`extract-order-id.mjs` reconstruye exclusivamente bloques de respuesta `- v application/json` concatenando sus líneas contiguas precedidas por `|` sin introducir separadores. Parsea JSON y valida la propiedad propia y superior `orderId`, tipo string, con formato `ORD-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` hexadecimal. Ignora request, tests y console HTTP_EVIDENCE. Ausencia, formato incorrecto, JSON inválido o IDs distintos ambiguos producen error explícito; CLI termina 1.

Uso desde esta carpeta: `node extract-order-id.mjs ../corrida-02/06-postman-stdout.txt`. Solo lee el archivo indicado y escribe ID en stdout.

## TDD observado

Comando idéntico en RED/GREEN, desde herramientas: `timeout 30s node --test extract-order-id.test.mjs`.

- RED, implementación ingenua anterior: exitcode **1**, 7 tests, 2 pasan y 5 fallan. Ambas fixtures reales fallaron por `Expected exactly one orderId`. Evidencia: `RED-{comando,inicio,fin,stdout,stderr,exitcode}.txt`.
- GREEN tras reconstrucción y parseo: exitcode **0**, **7/7 tests**. Evidencia equivalente `GREEN-*`.
- Triangulación: UUID sintético partido, ausencia explícita, texto de tests/request/console excluido, UUID no hexadecimal, tipo numérico, propiedad anidada, JSON inválido e IDs ambiguos.

IDs exactos comprobados contra los stdout originales, abiertos solo en lectura:

1. `../corrida-02/06-postman-stdout.txt`: `ORD-4cc41fe7-7675-4929-a274-74f02a7b3a1e`.
2. `../../postman-cli/corrida-02-sin-output/stdout.txt`: `ORD-abf9d555-aa78-4f7f-8ff6-ae0a520a816a`.

Límite: parser del formato verbose observado de Postman, no reporter oficial ni parser genérico de cualquier versión. No reejecuta experimentos ni modifica el estado live. Captura GUI y escenario con workers apagados siguen pendientes; no se completan CP formales.
