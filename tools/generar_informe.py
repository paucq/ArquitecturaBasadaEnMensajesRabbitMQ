"""Compila diez reportes y siete capturas existentes; no ejecuta la aplicación.

Python es tooling opcional: la aplicación Node no depende de este generador.
"""
from __future__ import annotations

import argparse
import html
import json
import os
import re
import sys
import textwrap
from datetime import datetime, timezone
from importlib import import_module
from importlib.metadata import version
from pathlib import Path
from typing import Any
from urllib.parse import quote, unquote, urlsplit

CASES = (
    'casos-funcionales/reporteCP01.md', 'casos-funcionales/reporteCP02.md',
    'casos-funcionales/reporteCP03.md', 'casos-funcionales/reporteCP06.md',
    'responsive/reporteCP07.md', 'message-driven/reporteCP08.md',
    'resilient/reporteCP09.md', 'reparto-carga/reporteCP10.md',
    'consumidores-apagados/corrida-03/reporteCP11.md', 'recuperacion/reporteCP12.md',
)
FIELDS = (
    'ID del caso', 'Arquitectura', 'Objetivo', 'Precondiciones', 'Datos de entrada',
    'Pasos ejecutados', 'Resultado esperado', 'Resultado obtenido',
    'Evidencia (capturas)', 'Estado', 'Análisis técnico',
)
LINK = re.compile(r'!?\[([^\]]+)\]\(([^)]+)\)')
REMOTE = 'https://github.com/paucq/ArquitecturaBasadaEnMensajesRabbitMQ/blob/main/'


def safe_path(root: Path, relative: str) -> Path:
    """Resuelve una ruta sin permitir escapes ni rutas absolutas.

    Args:
        root: Raíz autorizada de lectura o escritura.
        relative: Ruta relativa, posiblemente con segmentos internos '..'.

    Returns:
        Ruta absoluta contenida en root; rechaza escapes y enlaces simbólicos externos.
    """
    if Path(relative).is_absolute() or '\\' in relative:
        raise ValueError(f'Ruta no relativa: {relative}')
    try:
        result = (root / relative).resolve()
        resolved_root = root.resolve()
    except (OSError, RuntimeError) as error:
        raise ValueError(f'Ruta no resoluble: {relative}') from error
    if not result.is_relative_to(resolved_root):
        raise ValueError(f'Ruta fuera de raíz: {relative}')
    return result


def check_output_root(root: Path) -> None:
    """Rechaza una raíz inexistente o no escribible antes de generar salidas."""
    try:
        writable = root.is_dir() and os.access(root, os.W_OK)
    except OSError as error:
        raise PermissionError('No se pudo consultar la raíz de salida') from error
    if not writable:
        raise PermissionError('La raíz de salida debe existir y permitir escritura')


def missing_fields(text: str) -> list[str]:
    """Enumera etiquetas obligatorias ausentes, tolerando énfasis Markdown."""
    plain = text.replace('**', '')
    labels = {line[2:].split(':', 1)[0] for line in plain.splitlines()
              if line.startswith('- ') and ':' in line}
    return [field for field in FIELDS if field not in labels]


def image_links(text: str) -> list[str]:
    """Detecta imágenes enlazadas con o sin sintaxis de imagen Markdown."""
    return list(dict.fromkeys(target for _, target in LINK.findall(text)
                              if urlsplit(target).path.lower().endswith('.png')))


def rewrite_links(text: str, source: Path, root: Path) -> str:
    """Reubica enlaces locales para docs/entrega sin modificar código literal."""
    result = []
    fenced = False
    for line in text.splitlines():
        if line.lstrip().startswith('```'):
            fenced = not fenced
        if not fenced and not line.lstrip().startswith('```'):
            def replace(match: re.Match[str]) -> str:
                target = match.group(2)
                parsed = urlsplit(target)
                if parsed.scheme or target.startswith('#'):
                    return match.group(0)
                absolute = safe_path(root, str(source.parent.relative_to(root)
                                              / unquote(parsed.path)))
                relative = absolute.relative_to(root).as_posix()
                suffix = ('#' + parsed.fragment) if parsed.fragment else ''
                return f'[{match.group(1)}](../../{quote(relative)}{suffix})'
            line = LINK.sub(replace, line)
        result.append(line)
    return '\n'.join(result) + '\n'


def pdf_text(text: str) -> str:
    """Normaliza Unicode no soportado por Helvetica/WinAnsi sin cuadros negros."""
    for old, new in {'→': '->', '←': '<-', '×': 'x', '≤': '<=', '≥': '>=',
                     '−': '-', '↔': '<->', '\u00a0': ' '}.items():
        text = text.replace(old, new)
    return text.encode('cp1252', errors='xmlcharrefreplace').decode('cp1252')


def code_lines(text: str) -> list[str]:
    """Envuelve líneas de código a 90 caracteres, conservando espacios iniciales."""
    return [part for line in text.splitlines() for part in
            (textwrap.wrap(pdf_text(line.expandtabs(4)), width=90,
                           replace_whitespace=False, drop_whitespace=False) or [''])]


def compile_report(source_root: Path, generated_at: str) -> tuple[str, list[dict[str, str]]]:
    """Compila reportes íntegros y reúne imágenes existentes por ruta única.

    Args:
        source_root: Raíz con rabbitmq/ y evidencias/rabbitmq/.
        generated_at: Fecha UTC de compilación, independiente de los ensayos.

    Returns:
        Markdown consolidado y catálogo de capturas originales.
    """
    evidence = safe_path(source_root, 'evidencias/rabbitmq')
    sections = []
    images: dict[str, dict[str, str]] = {}
    for case in CASES:
        source = safe_path(evidence, case)
        text = source.read_text(encoding='utf-8')
        missing = missing_fields(text)
        if missing:
            raise ValueError(f'{case}: faltan {missing}')
        for target in image_links(text):
            path = safe_path(source_root, str(source.parent.relative_to(source_root) / target))
            if not path.is_file():
                raise FileNotFoundError(path.name)
            relative = path.relative_to(source_root).as_posix()
            caption = CAPTIONS.get(path.name, path.name)
            images[relative] = {'path': relative, 'caption': caption}
        # Verifica todos los enlaces locales sin ejecutar ni importar la aplicación.
        rewritten = rewrite_links(text, source, source_root)
        for _, target in LINK.findall(rewritten):
            if target.startswith('../../'):
                path = safe_path(source_root, unquote(urlsplit(target).path[6:]))
                if not path.is_file():
                    raise FileNotFoundError(f'Enlace local inexistente: {target}')
        sections.append(rewritten)
    if len(images) != 7:
        raise ValueError(f'Se esperaban siete PNG distintas, hay {len(images)}')
    matrix = '\n'.join(f'| CP-{number:02} | Cumple |' for number in
                       (1, 2, 3, 6, 7, 8, 9, 10, 11, 12))
    opening = INTRO.replace('{generated_at}', generated_at).replace('{matrix}', matrix)
    gallery = '\n\n# Anexo: siete capturas originales\n\n' + '\n\n'.join(
        f'Figura {index}. {item["caption"]}\n\n'
        f'[{item["path"]}](../../{quote(item["path"])})'
        for index, item in enumerate(images.values(), 1))
    return opening + '\n\n'.join(sections) + CONCLUSIONS + gallery, list(images.values())


CAPTIONS = {
    'postman-cli-pedido-aceptado.png':
        'CP-01/07/09: captura real de stdout Postman CLI guardado, no GUI. '
        'Pedido b7a; aceptación HTTP 202, 27 ms. Fuente corrida 03.',
    'management-pedido-pendiente.png':
        'CP-02/09/11: GUI Management, pendiente con Consumers=0. '
        'Contadores sin ID: correlación b7a por baseline vacío y publicación única.',
    'management-pedido-consumido.png':
        'CP-03/09/11: GUI Management final, cola vacía y dos consumidores. '
        'No muestra ID: contrastar logs b7a de corrida 03.',
    'docker-logs-worker-1.png':
        'CP-10: Docker Desktop worker-1, lote 01:58 UTC, tres procesamientos. '
        'No confundir registros previos de otros pedidos.',
    'docker-logs-worker-2.png':
        'CP-10: Docker Desktop worker-2, tres procesamientos del lote 01:58 UTC. '
        'También contiene b7a 01:46 UTC, reutilizado solo para CP-03/07/09/11.',
    'captura-trazabilidad-api-broker-worker.png':
        'CP-06/08, ID 8d48: captura real de VISTA DERIVADA de registros reales. '
        'No GUI ni JSONL nativo; consultar broker-native-original.jsonl. Sin recortes.',
    'captura-recuperacion-worker.png':
        'CP-12, ID ea298: captura real de VISTA DERIVADA de fuentes originales. '
        'No GUI. PENDIENTE es leyenda histórica previa a recibir la foto; caso cerrado. '
        'Dos entregas, un processed; no exactly-once. Sin recortes.',
}

INTRO = '''# Trabajo académico RabbitMQ

## Resultado y alcance

Diez casos RabbitMQ documentados como Cumple, conclusión propia y no evaluación del
profesor. Este PDF consolida la parte RabbitMQ requerida por la guía, no la entrega
global de veinte casos ni el experimento comparativo Kafka. Objetivo: verificar
integración HTTP, mensajería y consumo mediante evidencia histórica genuina.
Generación documental UTC: {generated_at}. Ensayos: 2026-10-27 UTC; no se repitieron.
No se inventan integrantes, grupo, fecha de entrega, licencia ni evaluación docente.

Código de destino y navegación: [repositorio GitHub](https://github.com/paucq/ArquitecturaBasadaEnMensajesRabbitMQ).
La URL expresa el destino previsto, no acredita push ni acceso remoto verificado.
Rutas conservadas desde la raíz: rabbitmq/ y evidencias/rabbitmq/.
El PDF convierte enlaces a GitHub blob/main; el Markdown mantiene enlaces relativos.
No se publica el PDF original del profesor.

## Arquitectura e infraestructura

Diagrama propio funcional, no captura de GUI observada. Cliente HTTP -> API -> broker
RabbitMQ / cola pedidos -> worker-1 o worker-2. Los workers compiten por mensaje:
no broadcast. Cuatro contenedores independientes: una API, un broker, dos workers.
HTTP POST /orders en 127.0.0.1:3000; AMQP TCP en 127.0.0.1:5672; Management HTTP en
127.0.0.1:15672. Dos réplicas comparten pedidos. Fuente de estado histórico:
[Compose ps](../../evidencias/rabbitmq/verificacion-inicial/compose-ps.txt).
Diagrama vectorial propio: [SVG](arquitectura-rabbitmq.svg).

Node.js/Express/amqplib; canal de confirmación del productor, cola durable=true,
publicación persistent=true, messageId=correlationId=orderId. El worker usa ack manual
(noAck=false), prefetch(1) y demora simulada PROCESSING_DELAY_MS default 3000 ms antes
del ack. Configuración y fragmentos literales se incluyen en CP-08; los intervalos
observados no prueban un SLA ni configuración efectiva exacta de 3 s.
El ack confirma consumo, no una notificación externa real. Durabilidad/persistencia
no equivalen a HA ni exactly-once. RabbitMQ 4.4.0 consta en CP-06; etiqueta histórica
rabbitmq:4-management en Compose no fija por sí sola la versión ejecutada.

## Entorno, metodología y trazabilidad

Los estados de Docker/Management, versiones y horas citados son históricos; no son
verificación de la máquina Windows destino ni de Hyper-V. La reconstrucción PDF es
Python opcional; Node no depende de Python. Ruta Windows opcional, sin WSL:

```powershell
py -m venv .venv
.venv\\Scripts\\python -m pip install -r tools/requirements-informe.txt
.venv\\Scripts\\python tools/generar_informe.py
```

Este generador no ejecutó Docker, Postman, curl ni solicitudes. El padre informó
Start/Test/Stop reales PASS en 77 s en proyecto aislado, 2/2 tests y npm con cero
vulnerabilidades; conservó los cuatro IDs originales y el volumen aislado al detener.
Ese diagnóstico utilizó PowerShell 7.6.9 en Linux, Node 26.8.1 en el host,
Docker Engine 29.6.2 y Node 24 dentro de los contenedores:
valida allí los scripts PowerShell, no una máquina Windows/Hyper-V nativa. La
validación nativa Windows/Hyper-V sigue sin realizarse. Este resultado, comunicado
por el integrador, es separado de los ensayos históricos y de las pruebas offline
del generador. No se atribuyen solicitudes nuevas a los casos históricos.

Se incorporan íntegros los once campos de cada reporte. Logs raw y comandos enlazados
permanecen en evidencias/rabbitmq; no se copian cientos de líneas sin contexto al PDF.
Las siete PNG se incluyen completas al final, una por página con orientación adecuada.
Capturas CLI, GUI y vistas derivadas están identificadas por separado.

Familias de IDs: b7a74952 (CP-01/02/03/07/09/11, una publicación compartida);
8d488fb8 (CP-06/08, traza nativa); seis IDs exclusivos de CP-10 (tabla enlazada);
ea298437 (CP-12). UUID completos figuran en cada caso. No mezclar los experimentos.
En CP-06 published/received nativos del broker preceden al log API order_published:
el log API se escribe tras confirmación. received nativo significa entrega, no ack.
El broker registra IDs mediante rabbitmq_tracing, no mediante su stdout operativo
habitual; se conservaron JSONL/payload y comprobación de restauración del diagnóstico.

Los PENDIENTE de resúmenes iniciales, recovery.json y la vista CP-12 conservan su
cronología previa a recibir capturas. No invalidan el cierre actual de los diez casos.
CP-09 ya enlaza la recuperación cerrada CP-12; se preserva la fuente corregida recibida.

## Matriz de cobertura RabbitMQ

| Caso | Estado documental propio |
| --- | --- |
{matrix}

## Reportes completos: once campos por caso

'''

CONCLUSIONS = '''

# Análisis integrado y conclusiones — guía §10

## Asincronía, mediación y distribución

CP-07 y CP-11 separan aceptación y consumo: workers ausentes, HTTP 202 en 27 ms,
Ready 0 -> 1 y consumo posterior sin publicar de nuevo. No hay SLA. CP-06/08
acreditan el salto por el broker con ID/payload nativos; no basta comparar contadores.
CP-10 observa 3/3 en seis pedidos con dos consumidores competidores; no mide
escalabilidad lineal, autoscaling ni equilibrio garantizado. CP-09 conserva continuidad
de aceptación ante indisponibilidad controlada; no demuestra caída del broker.
CP-12 interrumpe trabajo Unacked: vuelve a Ready y se reentrega false -> true;
dos entregas y un order_processed del mismo ID, no exactly-once ni idempotencia.

## 1. ¿Qué dificultades se presentaron en las pruebas?

El stdout de Postman parte UUID en líneas: el parser debe reconstruir el resultado
guardado sin publicar pedidos adicionales. El intento --output requirió login cloud;
se usó stdout local conservado, no se afirma publicación cloud. Management puede
mostrar estadísticas stale: se recurrió a baseline y esperas acotadas, no a una foto
como prueba universal. El comando stop terminó 0 mientras los contenedores acabaron
137; son resultados distintos, no parada graciosa. CP-06 necesitó tracing nativo por
ID porque stdout operativo del broker no lo contenía. CP-12 requirió instrumentación
SIGSTOP y gate Unacked antes de SIGKILL para observar trabajo en vuelo. Fuentes:
[historial consumidores](../../evidencias/rabbitmq/consumidores-apagados/RESUMEN.md),
[trazabilidad](../../evidencias/rabbitmq/trazabilidad/RESUMEN.md),
[recuperación](../../evidencias/rabbitmq/recuperacion/RESUMEN.md),
[reparto](../../evidencias/rabbitmq/reparto-carga/RESUMEN.md).

## 2. ¿Qué arquitectura es más robusta desde QA?

La evidencia limitada de RabbitMQ respalda desacoplamiento, almacenamiento temporal
y recuperación del consumidor en los escenarios descritos. No permite elegir un
ganador frente a Kafka, que no fue evaluado en esta entrega. No se prueban HA,
downtime cero, ausencia general de pérdida, fallo del broker ni efectos externos
exactly-once. Una muestra favorable no es garantía de producción.

## 3. ¿Qué diferencias reales se evidenciaron entre las arquitecturas?

La comparación experimental sigue pendiente de los diez casos Kafka y análisis
conjunto. No se inventan diferencias medidas. Aquí solo se verificaron propiedades
de la arquitectura RabbitMQ descrita en el Anexo 1, sin equivalencia con Kafka.

## Fuentes normativas y límites de entrega

Taller Pruebas de Integración.pdf, 24 páginas: p. 3 (componentes independientes,
Docker y evidencia de despliegue); p. 4 §7 (casos y once campos); p. 5 §10
(tres preguntas), §11 (documento PDF, pruebas/capturas/logs y repo o ZIP);
Anexo 1 pp. 7–13 (flujo RabbitMQ, API, consumo, ack y pruebas). p. 13 complementa
la entrega RabbitMQ. Citas según auditoría documental directa de las 24 páginas;
no se atribuyen exigencias a una página 22 no identificada por esa auditoría.
No se redistribuye el original del profesor. Los reportes completos anteriores y sus
fuentes preservadas son la base experimental, no estas conclusiones como evidencia nueva.
La publicación GitHub y revisión visual final del PDF corresponden al padre.
La ejecución aislada PowerShell/Linux informada por el integrador pasó; no certifica
Windows/Hyper-V nativo, todavía no verificado. Son comprobaciones distintas de esta
compilación offline.
'''


def diagram() -> Any:
    """Construye un diagrama vectorial propio, nunca evidencia de ejecución."""
    shapes = import_module('reportlab.graphics.shapes')
    Drawing, Line, Rect, String = shapes.Drawing, shapes.Line, shapes.Rect, shapes.String
    drawing = Drawing(490, 175)
    drawing.add(String(0, 160, 'Diagrama propio funcional - no GUI observada', fontSize=10))
    nodes = [(0, 65, 'Cliente HTTP'), (115, 65, 'orders-api'),
             (240, 65, 'RabbitMQ/pedidos'), (380, 110, 'worker-1'), (380, 20, 'worker-2')]
    for x, y, label in nodes:
        drawing.add(Rect(x, y, 105, 30, fillColor=None))
        drawing.add(String(x + 4, y + 12, label, fontSize=10))
    for x1, y1, x2, y2 in [(105, 80, 115, 80), (220, 80, 240, 80),
                           (345, 80, 380, 125), (345, 80, 380, 35)]:
        drawing.add(Line(x1, y1, x2, y2))
    return drawing


def inline_pdf(text: str) -> str:
    """Escapa texto y convierte enlaces a destinos remotos portables."""
    def replace(match: re.Match[str]) -> str:
        label, target = match.groups()
        if target.startswith('../../'):
            target = REMOTE + target[6:]
        elif not urlsplit(target).scheme and not target.startswith('#'):
            target = REMOTE + 'docs/entrega/' + target
        return f'<link href="{html.escape(target, quote=True)}" color="blue">' + html.escape(
            pdf_text(label)) + '</link>'
    parts = []
    start = 0
    for match in LINK.finditer(text):
        parts.append(html.escape(pdf_text(text[start:match.start()])))
        parts.append(replace(match))
        start = match.end()
    parts.append(html.escape(pdf_text(text[start:])))
    return ''.join(parts).replace('**', '').replace('`', '')


def build_pdf(markdown: str, images: list[dict[str, str]], source_root: Path,
              output: Path) -> dict[str, object]:
    """Genera texto, diagrama y siete páginas de capturas completas; valida con pypdf."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.platypus import (
        BaseDocTemplate,
        Frame,
        Image,
        NextPageTemplate,
        PageBreak,
        PageTemplate,
        Paragraph,
        Preformatted,
        Spacer,
    )

    PillowImage = import_module('PIL.Image')
    PdfReader = import_module('pypdf').PdfReader
    styles = getSampleStyleSheet()
    body = ParagraphStyle('BodyWrapped', parent=styles['BodyText'], fontSize=10,
                          leading=14, wordWrap='CJK', spaceAfter=5)
    code = ParagraphStyle('CodeWrapped', fontName='Courier', fontSize=7.6, leading=10)
    doc = BaseDocTemplate(str(output), pagesize=A4, title='Trabajo académico RabbitMQ',
                          author='', leftMargin=36, rightMargin=36,
                          topMargin=40, bottomMargin=36)
    def footer(canvas: Any, document: Any) -> None:
        canvas.saveState()
        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(colors.grey)
        canvas.drawString(36, 20, f'RabbitMQ | documentación histórica | {document.page}')
        canvas.restoreState()
    templates = []
    for name, size in [('portrait', A4), ('landscape', landscape(A4))]:
        width, height = size
        templates.append(PageTemplate(id=name, pagesize=size, onPage=footer,
                                      frames=[Frame(36, 36, width - 72, height - 76,
                                                    leftPadding=0, rightPadding=0,
                                                    topPadding=0, bottomPadding=0)]))
    doc.addPageTemplates(templates)
    story = []
    in_code = False
    code_buffer = []
    text_part = markdown.split('# Anexo: siete capturas originales')[0]
    for line in text_part.splitlines():
        if line.startswith('```'):
            if in_code:
                story.append(Preformatted('\n'.join(code_lines('\n'.join(code_buffer))), code))
                code_buffer = []
            in_code = not in_code
            continue
        if in_code:
            code_buffer.append(line)
            continue
        if not line.strip():
            story.append(Spacer(1, 4))
            continue
        if line.startswith('#'):
            level = min(len(line) - len(line.lstrip('#')), 3)
            if re.match(r'^#{1,3} CP-\d+', line):
                story.append(PageBreak())
            story.append(Paragraph(inline_pdf(line.lstrip('# ')), styles[f'Heading{level}']))
            if line == '## Arquitectura e infraestructura':
                story.append(diagram())
                story.append(Paragraph('Diagrama propio funcional; no GUI observada.', body))
        else:
            # Tablas se muestran por fila textual completa: sin columnas que recorten URLs.
            story.append(Paragraph(inline_pdf(line), body))
    image_checks = []
    for index, item in enumerate(images, 1):
        path = safe_path(source_root, item['path'])
        with PillowImage.open(path) as image:
            width, height = image.size
        candidates = [('portrait', A4), ('landscape', landscape(A4))]
        template, (page_width, page_height) = max(
            candidates, key=lambda item: min((item[1][0] - 72) / width,
                                            (item[1][1] - 166) / height))
        available_width, available_height = page_width - 72, page_height - 166
        scale = min(available_width / width, available_height / height)
        story.extend([NextPageTemplate(template), PageBreak(),
                      Paragraph(f'Figura {index}. {inline_pdf(item["caption"])}', body),
                      Paragraph(inline_pdf(f'[Original preservado](../../{quote(item["path"])})'), body),
                      Image(str(path), width=width * scale, height=height * scale)])
        image_checks.append({'path': item['path'], 'pixels': [width, height],
                             'display_points': [round(width * scale, 2),
                                                round(height * scale, 2)],
                             'orientation': template, 'cropped': False})
    doc.build(story)
    reader = PdfReader(output)
    extracted = '\n'.join(page.extract_text() for page in reader.pages)
    ids = [f'CP-{number:02}' for number in (1, 2, 3, 6, 7, 8, 9, 10, 11, 12)]
    for case_id in ids:
        if case_id not in extracted:
            raise ValueError(f'PDF sin caso {case_id}')
    headings = list(re.finditer(r'^CP-\d{2} [—–-] [^\n]+', extracted, re.MULTILINE))
    if len(headings) != 10:
        raise ValueError(f'PDF: {len(headings)} encabezados de caso; se esperaban diez')
    for index, heading in enumerate(headings):
        end = headings[index + 1].start() if index + 1 < len(headings) else len(extracted)
        case_text = extracted[heading.start():end]
        for field in FIELDS:
            if field not in case_text:
                raise ValueError(f'PDF: {heading.group(0)} sin campo {field}')
    image_objects = set()
    remote_links = 0
    for page in reader.pages:
        for annotation in page.get('/Annots', []):
            action = annotation.get_object().get('/A', {})
            uri = str(action.get('/URI', ''))
            if uri:
                if not uri.startswith(('https://', 'http://')) or '/home/' in uri:
                    raise ValueError(f'Enlace PDF no portable: {uri}')
                remote_links += 1
        resources = page.get('/Resources', {})
        for obj in resources.get('/XObject', {}).values():
            if obj.get_object().get('/Subtype') == '/Image':
                image_objects.add((obj.idnum, obj.generation))
    if len(image_objects) != 7:
        raise ValueError(f'PDF: {len(image_objects)} imágenes únicas, se esperaban 7')
    if any(not page.extract_text().strip() for page in reader.pages):
        raise ValueError('PDF contiene página vacía')
    expected_pixels = set()
    for item in images:
        with PillowImage.open(safe_path(source_root, item['path'])) as original:
            expected_pixels.add((original.size, original.convert('RGB').tobytes()))
    embedded_pixels = {(image.image.size, image.image.convert('RGB').tobytes())
                       for page in reader.pages for image in page.images}
    if embedded_pixels != expected_pixels:
        raise ValueError('Las imágenes PDF no coinciden píxel a píxel con las siete fuentes')
    if '/home/' in extracted or '\u25a0' in extracted:
        raise ValueError('PDF con ruta absoluta o cuadro de glifo no soportado')
    return {'pages': len(reader.pages), 'unique_image_xobjects': len(image_objects),
            'seven_images_pixel_identical': True, 'portable_http_links': remote_links,
            'case_ids_present': ids, 'fields_per_case': len(FIELDS),
            'all_eleven_fields_in_each_case': True, 'empty_pages': 0,
            'layout_error': False, 'images': image_checks,
            'visual_review': 'Pendiente; extracción de texto/objetos no certifica legibilidad visual',
            'native_windows': 'Windows/Hyper-V nativo no verificado; padre informa '
                              'Start/Test/Stop PASS 77 s, 2/2 tests, npm 0 vulnerabilidades '
                              'en PowerShell 7.6.9/Linux, Node host 26.8.1, '
                              'Docker Engine 29.6.2 y Node 24 en contenedores'}


def main() -> None:
    """Procesa raíces explícitas y escribe únicamente los artefactos documentales."""
    parser = argparse.ArgumentParser(description=__doc__)
    default_root = Path(__file__).resolve().parents[1]
    parser.add_argument('--source-root', type=Path, default=default_root)
    parser.add_argument('--output-root', type=Path, default=default_root)
    args = parser.parse_args()
    source_root, output_root = args.source_root.resolve(), args.output_root.resolve()
    check_output_root(output_root)
    generated_at = datetime.now(timezone.utc).isoformat()
    markdown, images = compile_report(source_root, generated_at)
    docs = safe_path(output_root, 'docs/entrega')
    delivery = safe_path(output_root, 'entrega')
    docs.mkdir(parents=True, exist_ok=True)
    delivery.mkdir(parents=True, exist_ok=True)
    (docs / 'INFORME_RABBITMQ.md').write_text(markdown, encoding='utf-8')
    from reportlab.graphics import renderSVG
    renderSVG.drawToFile(diagram(), str(docs / 'arquitectura-rabbitmq.svg'))
    checks = build_pdf(markdown, images, source_root, delivery / 'Informe_RabbitMQ.pdf')
    checks.update({'generated_at_utc': generated_at,
                   'versions': {name: version(name) for name in
                                ('pypdf', 'reportlab', 'pillow', 'charset-normalizer')},
                   'source_root': 'Raíz de lectura explícita; rutas absolutas no publicadas',
                   'pdf': 'entrega/Informe_RabbitMQ.pdf',
                   'source_markdown': 'docs/entrega/INFORME_RABBITMQ.md'})
    payload = json.dumps(checks, ensure_ascii=False, indent=2)
    (docs / 'validation-generacion.json').write_text(payload + '\n', encoding='utf-8')
    print(payload)


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError) as error:
        print(f'No se pudo compilar el informe: {error}', file=sys.stderr)
        raise SystemExit(1) from error
