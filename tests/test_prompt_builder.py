"""Tests unitarios para prompt_builder.py."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

import constants
import prompt_builder
from constants import MAX_BODY_CHARS
from prompt_builder import build_prompt


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

FAKE_CONTEXT = "Soy el tutor PIR. Llevo 5 años de experiencia."
FAKE_EXAMPLE_1 = "## EMAIL RECIBIDO\nHola\n\n## MI RESPUESTA\nHola, gracias por escribir."
FAKE_EXAMPLE_2 = "## EMAIL RECIBIDO\n¿Cuántas plazas hay?\n\n## MI RESPUESTA\nDepende de la convocatoria."
FAKE_DOC_CONTEXT = "Contexto cargado desde Google Doc."


class _FakePath:
    """Path mínimo que soporta comparación (necesaria para sorted()) y read_text."""

    def __init__(self, name: str, text: str) -> None:
        self._name = name
        self._text = text

    def read_text(self, encoding: str = "utf-8") -> str:
        return self._text

    def __lt__(self, other: "_FakePath") -> bool:
        return self._name < other._name


def _patch_fs(
    context_text: str = FAKE_CONTEXT,
    examples: list[str] | None = None,
    google_doc_fails: bool = True,
):
    """Devuelve los patches necesarios para aislar el filesystem y la red.

    Por defecto el fetch del Google Doc falla para que se use el fallback local.
    Pasar google_doc_fails=False para simular un fetch exitoso (context_text se
    ignora en ese caso; se usa FAKE_DOC_CONTEXT).
    """
    if examples is None:
        examples = [FAKE_EXAMPLE_1, FAKE_EXAMPLE_2]

    mock_context_file = MagicMock()
    mock_context_file.read_text.return_value = context_text

    fake_paths = [
        _FakePath(name=f"example_{i:02d}.md", text=text)
        for i, text in enumerate(examples, start=1)
    ]

    mock_examples_dir = MagicMock()
    mock_examples_dir.exists.return_value = True
    mock_examples_dir.glob.return_value = iter(fake_paths)

    if google_doc_fails:
        fetch_patch = patch.object(
            prompt_builder,
            "_fetch_google_doc",
            side_effect=OSError("network error"),
        )
    else:
        fetch_patch = patch.object(
            prompt_builder,
            "_fetch_google_doc",
            return_value=FAKE_DOC_CONTEXT,
        )

    return (
        fetch_patch,
        patch.object(prompt_builder, "_CONTEXT_FILE", mock_context_file),
        patch.object(prompt_builder, "_EXAMPLES_DIR", mock_examples_dir),
    )


# ---------------------------------------------------------------------------
# Tests: build_prompt — estructura de retorno
# ---------------------------------------------------------------------------


class TestBuildPromptReturnType:
    def test_returns_tuple_of_three_elements(self):
        p1, p2, p3 = _patch_fs()
        with p1, p2, p3:
            result = build_prompt("Email de prueba")
        assert isinstance(result, tuple)
        assert len(result) == 3

    def test_first_two_elements_are_strings(self):
        p1, p2, p3 = _patch_fs()
        with p1, p2, p3:
            system_msg, user_msg, _ = build_prompt("Email de prueba")
        assert isinstance(system_msg, str)
        assert isinstance(user_msg, str)

    def test_context_source_is_string(self):
        p1, p2, p3 = _patch_fs()
        with p1, p2, p3:
            _, _, context_source = build_prompt("Email de prueba")
        assert isinstance(context_source, str)

    def test_system_message_is_not_empty(self):
        p1, p2, p3 = _patch_fs()
        with p1, p2, p3:
            system_msg, _, _ = build_prompt("Email de prueba")
        assert system_msg.strip() != ""

    def test_user_message_is_not_empty(self):
        p1, p2, p3 = _patch_fs()
        with p1, p2, p3:
            _, user_msg, _ = build_prompt("Email de prueba")
        assert user_msg.strip() != ""


# ---------------------------------------------------------------------------
# Tests: context_source — google_doc vs fallback
# ---------------------------------------------------------------------------


class TestContextSource:
    def test_returns_google_doc_when_fetch_succeeds(self):
        p1, p2, p3 = _patch_fs(google_doc_fails=False)
        with p1, p2, p3:
            _, _, context_source = build_prompt("Hola")
        assert context_source == "google_doc"

    def test_returns_fallback_when_fetch_fails(self):
        p1, p2, p3 = _patch_fs(google_doc_fails=True)
        with p1, p2, p3:
            _, _, context_source = build_prompt("Hola")
        assert context_source == "fallback"

    def test_system_message_uses_google_doc_content_when_fetch_succeeds(self):
        p1, p2, p3 = _patch_fs(google_doc_fails=False)
        with p1, p2, p3:
            system_msg, _, _ = build_prompt("Hola")
        assert FAKE_DOC_CONTEXT in system_msg

    def test_system_message_uses_local_content_when_fetch_fails(self):
        p1, p2, p3 = _patch_fs(context_text=FAKE_CONTEXT, google_doc_fails=True)
        with p1, p2, p3:
            system_msg, _, _ = build_prompt("Hola")
        assert FAKE_CONTEXT in system_msg

    def test_fallback_on_timeout(self):
        import urllib.error
        p2 = patch.object(prompt_builder, "_CONTEXT_FILE", MagicMock(read_text=MagicMock(return_value=FAKE_CONTEXT)))
        p3 = patch.object(prompt_builder, "_EXAMPLES_DIR", MagicMock(exists=MagicMock(return_value=False)))
        with patch.object(prompt_builder, "_fetch_google_doc", side_effect=TimeoutError("timeout")), p2, p3:
            _, _, context_source = build_prompt("Hola")
        assert context_source == "fallback"

    def test_fallback_on_http_error(self):
        import urllib.error
        p2 = patch.object(prompt_builder, "_CONTEXT_FILE", MagicMock(read_text=MagicMock(return_value=FAKE_CONTEXT)))
        p3 = patch.object(prompt_builder, "_EXAMPLES_DIR", MagicMock(exists=MagicMock(return_value=False)))
        http_err = urllib.error.HTTPError(url="", code=403, msg="Forbidden", hdrs=None, fp=None)
        with patch.object(prompt_builder, "_fetch_google_doc", side_effect=http_err), p2, p3:
            _, _, context_source = build_prompt("Hola")
        assert context_source == "fallback"


# ---------------------------------------------------------------------------
# Tests: _fetch_google_doc
# ---------------------------------------------------------------------------


class TestFetchGoogleDoc:
    def test_calls_correct_export_url(self):
        mock_resp = MagicMock()
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = MagicMock(return_value=False)
        mock_resp.read.return_value = b"contenido del doc"

        with patch("urllib.request.urlopen", return_value=mock_resp) as mock_urlopen:
            result = prompt_builder._fetch_google_doc()

        called_req = mock_urlopen.call_args[0][0]
        assert constants.GOOGLE_DOC_ID in called_req.full_url
        assert "export" in called_req.full_url
        assert "format=txt" in called_req.full_url

    def test_returns_decoded_string(self):
        mock_resp = MagicMock()
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = MagicMock(return_value=False)
        mock_resp.read.return_value = "contexto con tildes: á é í".encode("utf-8")

        with patch("urllib.request.urlopen", return_value=mock_resp):
            result = prompt_builder._fetch_google_doc()

        assert isinstance(result, str)
        assert "á é í" in result

    def test_raises_on_network_failure(self):
        with patch("urllib.request.urlopen", side_effect=OSError("no network")):
            with pytest.raises(OSError):
                prompt_builder._fetch_google_doc()


# ---------------------------------------------------------------------------
# Tests: build_prompt — contenido del system message
# ---------------------------------------------------------------------------


class TestSystemMessage:
    def test_contains_context_content(self):
        p1, p2, p3 = _patch_fs(context_text=FAKE_CONTEXT)
        with p1, p2, p3:
            system_msg, _, _ = build_prompt("Hola")
        assert FAKE_CONTEXT in system_msg

    def test_contains_all_examples(self):
        p1, p2, p3 = _patch_fs(examples=[FAKE_EXAMPLE_1, FAKE_EXAMPLE_2])
        with p1, p2, p3:
            system_msg, _, _ = build_prompt("Hola")
        assert FAKE_EXAMPLE_1 in system_msg
        assert FAKE_EXAMPLE_2 in system_msg

    def test_examples_labeled_sequentially(self):
        p1, p2, p3 = _patch_fs(examples=[FAKE_EXAMPLE_1, FAKE_EXAMPLE_2])
        with p1, p2, p3:
            system_msg, _, _ = build_prompt("Hola")
        assert "Ejemplo 1" in system_msg
        assert "Ejemplo 2" in system_msg

    def test_contains_system_instructions(self):
        p1, p2, p3 = _patch_fs()
        with p1, p2, p3:
            system_msg, _, _ = build_prompt("Hola")
        assert prompt_builder.SYSTEM_INSTRUCTIONS in system_msg

    def test_no_examples_when_dir_empty(self):
        p1, p2, p3 = _patch_fs(examples=[])
        with p1, p2, p3:
            system_msg, _, _ = build_prompt("Hola")
        assert FAKE_CONTEXT in system_msg
        assert "Ejemplo 1" not in system_msg

    def test_no_examples_when_dir_missing(self):
        mock_context_file = MagicMock()
        mock_context_file.read_text.return_value = FAKE_CONTEXT
        mock_examples_dir = MagicMock()
        mock_examples_dir.exists.return_value = False

        with (
            patch.object(prompt_builder, "_fetch_google_doc", side_effect=OSError()),
            patch.object(prompt_builder, "_CONTEXT_FILE", mock_context_file),
            patch.object(prompt_builder, "_EXAMPLES_DIR", mock_examples_dir),
        ):
            system_msg, _, _ = build_prompt("Hola")

        assert FAKE_CONTEXT in system_msg


# ---------------------------------------------------------------------------
# Tests: build_prompt — contenido del user message
# ---------------------------------------------------------------------------


class TestUserMessage:
    def test_contains_original_email_when_short(self):
        email = "Este es un email corto."
        p1, p2, p3 = _patch_fs()
        with p1, p2, p3:
            _, user_msg, _ = build_prompt(email)
        assert email in user_msg

    def test_user_message_contains_instruction_verb(self):
        p1, p2, p3 = _patch_fs()
        with p1, p2, p3:
            _, user_msg, _ = build_prompt("Hola")
        assert "Redacta" in user_msg or "respuesta" in user_msg.lower()


# ---------------------------------------------------------------------------
# Tests: truncado de email
# ---------------------------------------------------------------------------


class TestTruncation:
    def test_email_longer_than_max_is_truncated(self):
        long_email = "x" * (MAX_BODY_CHARS + 500)
        p1, p2, p3 = _patch_fs()
        with p1, p2, p3:
            _, user_msg, _ = build_prompt(long_email)
        assert "x" * (MAX_BODY_CHARS + 1) not in user_msg

    def test_email_truncated_to_exactly_max_chars(self):
        long_email = "A" * (MAX_BODY_CHARS + 1000)
        p1, p2, p3 = _patch_fs()
        with p1, p2, p3:
            _, user_msg, _ = build_prompt(long_email)
        assert "A" * MAX_BODY_CHARS in user_msg
        assert "A" * (MAX_BODY_CHARS + 1) not in user_msg

    def test_email_shorter_than_max_is_not_truncated(self):
        short_email = "B" * (MAX_BODY_CHARS - 100)
        p1, p2, p3 = _patch_fs()
        with p1, p2, p3:
            _, user_msg, _ = build_prompt(short_email)
        assert short_email in user_msg

    def test_email_exactly_max_chars_is_not_truncated(self):
        exact_email = "C" * MAX_BODY_CHARS
        p1, p2, p3 = _patch_fs()
        with p1, p2, p3:
            _, user_msg, _ = build_prompt(exact_email)
        assert exact_email in user_msg

    def test_max_body_chars_constant_is_6000(self):
        assert MAX_BODY_CHARS == 6000


# ---------------------------------------------------------------------------
# Tests: constantes y rutas
# ---------------------------------------------------------------------------


class TestConstants:
    def test_context_file_path_ends_with_context_md(self):
        assert prompt_builder._CONTEXT_FILE.name == "context.md"

    def test_examples_dir_name_is_examples(self):
        assert prompt_builder._EXAMPLES_DIR.name == "examples"

    def test_context_file_is_under_context_dir(self):
        assert prompt_builder._CONTEXT_FILE.parent.name == "context"

    def test_examples_dir_is_under_context_dir(self):
        assert prompt_builder._EXAMPLES_DIR.parent.name == "context"

    def test_google_doc_id_comes_from_env(self):
        """GOOGLE_DOC_ID debe leerse de CONTEXT_GOOGLE_DOC_ID; si no está definida es ''."""
        import importlib
        import os
        import constants as _c
        with patch.dict(os.environ, {"CONTEXT_GOOGLE_DOC_ID": "test-doc-id-123"}):
            importlib.reload(_c)
            assert _c.GOOGLE_DOC_ID == "test-doc-id-123"
        importlib.reload(_c)  # restaurar estado original

    def test_google_doc_export_url_format(self):
        """La URL de export debe seguir el patrón de Google Docs con format=txt."""
        import importlib
        import os
        import constants as _c
        with patch.dict(os.environ, {"CONTEXT_GOOGLE_DOC_ID": "abc123"}):
            importlib.reload(_c)
            assert "abc123" in _c.GOOGLE_DOC_EXPORT_URL
            assert "export" in _c.GOOGLE_DOC_EXPORT_URL
            assert "format=txt" in _c.GOOGLE_DOC_EXPORT_URL
        importlib.reload(_c)

    def test_google_doc_export_url_requests_txt_format(self):
        assert "format=txt" in constants.GOOGLE_DOC_EXPORT_URL

    def test_max_body_chars_in_constants(self):
        assert constants.MAX_BODY_CHARS == 6000

    def test_fetch_timeout_is_positive(self):
        assert constants.FETCH_TIMEOUT_SECONDS > 0
