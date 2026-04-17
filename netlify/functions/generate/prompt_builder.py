"""Construye el prompt para Claude a partir del contexto y el email del tutorizado."""
from __future__ import annotations

import urllib.request
from pathlib import Path

from constants import (
    FETCH_TIMEOUT_SECONDS,
    GOOGLE_DOC_EXPORT_URL,
    MAX_BODY_CHARS,
)

# Busca el directorio 'context/' subiendo desde la ubicación de este archivo.
# - En Lambda (netlify deploy): los archivos bundleados están en /var/task/,
#   por lo que context/ está en el mismo nivel que este módulo.
# - En local (netlify/functions/generate/): sube hasta la raíz del repo.
_HERE = Path(__file__).resolve().parent
_REPO_ROOT = next(
    (p for p in [_HERE, *_HERE.parents] if (p / "context").exists()),
    _HERE,
)
_CONTEXT_FILE = _REPO_ROOT / "context" / "context.md"
_EXAMPLES_DIR = _REPO_ROOT / "context" / "examples"

SYSTEM_INSTRUCTIONS = """Instrucciones:
- Redacta SOLO el cuerpo del email de respuesta, sin asunto ni metadatos
- Usa el mismo idioma que el correo recibido (normalmente español)
- Ajusta el tono al de los ejemplos: cercano, de tú, conciso y alentador
- Si el correo menciona el nombre del tutorizado, úsalo en el saludo
- No inventes información sobre el proceso PIR que no esté en el contexto
- Si la pregunta es muy específica y no tienes datos suficientes, redacta una respuesta
  breve indicando que se tratará en la próxima tutoría individual
- Nunca garantices resultados ni prometas plazas"""


def _fetch_google_doc() -> str:
    """Descarga el Google Doc como texto plano. Lanza excepción si falla."""
    req = urllib.request.Request(
        GOOGLE_DOC_EXPORT_URL,
        headers={"User-Agent": "hermes/1.0"},
    )
    with urllib.request.urlopen(req, timeout=FETCH_TIMEOUT_SECONDS) as resp:
        return resp.read().decode("utf-8")


def _load_context() -> tuple[str, str]:
    """Devuelve (context_text, source).

    Intenta cargar el contexto desde el Google Doc. Si falla por cualquier
    motivo (sin conexión, doc privado, timeout…) cae al fichero local como
    fallback y devuelve source='fallback'.
    """
    try:
        return _fetch_google_doc(), "google_doc"
    except Exception:
        return _CONTEXT_FILE.read_text(encoding="utf-8"), "fallback"


def _load_examples() -> list[str]:
    if not _EXAMPLES_DIR.exists():
        return []
    files = sorted(_EXAMPLES_DIR.glob("*.md"))
    return [f.read_text(encoding="utf-8") for f in files]


def build_prompt(email_text: str) -> tuple[str, str, str]:
    """Devuelve (system_message, user_message, context_source).

    context_source es 'google_doc' si el contexto se cargó del Google Doc
    o 'fallback' si se usó el fichero local context/context.md.
    """
    context, context_source = _load_context()
    examples = _load_examples()

    examples_block = ""
    for i, example in enumerate(examples, start=1):
        examples_block += f"--- Ejemplo {i} ---\n{example}\n\n"

    system_message = f"""Eres un asistente que redacta respuestas de email en nombre de un tutor de oposiciones PIR (Psicólogo Interno Residente). El tutor gestiona ~100 tutorizados y recibe muchos correos diarios con dudas sobre el proceso de oposición, el estudio y orientación general.

A continuación tienes información de contexto sobre el tutor y el dominio PIR:
---
{context}
---

Para calibrar el tono, estos son ejemplos reales de correos recibidos y sus respuestas:
---
{examples_block.strip()}
---

{SYSTEM_INSTRUCTIONS}"""

    truncated_email = email_text[:MAX_BODY_CHARS]
    user_message = f"Redacta una respuesta al siguiente correo:\n\n{truncated_email}"

    return system_message, user_message, context_source
