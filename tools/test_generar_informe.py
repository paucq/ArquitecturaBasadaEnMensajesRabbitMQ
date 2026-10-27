"""Pruebas offline deterministas del compilador documental, sin runtime Node."""
import unittest
from pathlib import Path
from unittest.mock import patch

import generar_informe as informe


class CompilationTests(unittest.TestCase):
    """Protege integridad, portabilidad y límites de lectura/escritura."""

    def test_ten_cases_and_eleven_fields(self) -> None:
        self.assertEqual(len(informe.CASES), 10)
        self.assertEqual(len(informe.FIELDS), 11)
        text = '\n'.join(f'- **{field}:** valor' for field in informe.FIELDS)
        self.assertEqual(informe.missing_fields(text), [])
        self.assertEqual(informe.missing_fields(''), list(informe.FIELDS))

    def test_rewrite_links_preserves_code(self) -> None:
        root = Path('/project')
        source = root / 'evidencias/rabbitmq/casos-funcionales/reporteCP01.md'
        text = '[foto](a.png)\n```js\nconst x = "[x](a.png)";\n```\n'
        result = informe.rewrite_links(text, source, root)
        self.assertIn('../../evidencias/rabbitmq/casos-funcionales/a.png', result)
        self.assertIn('const x = "[x](a.png)";', result)

    def test_images_include_markdown_links_not_only_bang(self) -> None:
        self.assertEqual(informe.image_links('[a](a.png) ![b](b.png) [c](x.txt)'),
                         ['a.png', 'b.png'])

    def test_escape_rejected(self) -> None:
        with self.assertRaises(ValueError):
            informe.safe_path(Path('/project'), '../outside')
        with self.assertRaises(ValueError):
            informe.safe_path(Path('/project'), '/outside')

    def test_link_escape_rejected_and_remote_preserved(self) -> None:
        root = Path('/project')
        source = root / 'evidencias/rabbitmq/report.md'
        with self.assertRaises(ValueError):
            informe.rewrite_links('[escape](../../../outside)', source, root)
        remote = '[repo](https://github.com/paucq/repo)'
        self.assertEqual(informe.rewrite_links(remote, source, root).strip(), remote)

    def test_missing_field_is_detected(self) -> None:
        text = '\n'.join(f'- {field}: valor' for field in informe.FIELDS[:-1])
        self.assertEqual(informe.missing_fields(text), ['Análisis técnico'])

    def test_compiler_refuses_incomplete_report(self) -> None:
        with (
            patch.object(Path, 'read_text', return_value='- Objetivo: incompleto'),
            self.assertRaisesRegex(ValueError, 'faltan'),
        ):
            informe.compile_report(Path('/project'), '2000-01-01T00:00:00Z')

    def test_pdf_links_are_portable(self) -> None:
        result = informe.inline_pdf('[source](../../rabbitmq/worker.mjs)')
        self.assertIn(informe.REMOTE + 'rabbitmq/worker.mjs', result)
        self.assertNotIn('/home/', result)

    def test_resolution_io_error_is_reported(self) -> None:
        with (
            patch.object(Path, 'resolve', side_effect=OSError('inaccessible')),
            self.assertRaisesRegex(ValueError, 'no resoluble'),
        ):
            informe.safe_path(Path('/project'), 'file.md')

    def test_missing_root_is_rejected(self) -> None:
        with (
            patch.object(Path, 'is_dir', return_value=False),
            self.assertRaises(PermissionError),
        ):
            informe.check_output_root(Path('/project'))

    def test_code_wrap_and_unicode(self) -> None:
        lines = informe.code_lines('x' * 245 + ' → ok')
        self.assertLessEqual(max(map(len, lines)), 90)
        self.assertIn('->', informe.pdf_text('a → b'))

    def test_root_permission(self) -> None:
        with (
            patch('generar_informe.os.access', return_value=False),
            self.assertRaises(PermissionError),
        ):
            informe.check_output_root(Path(__file__).resolve().parent)


if __name__ == '__main__':
    unittest.main()
