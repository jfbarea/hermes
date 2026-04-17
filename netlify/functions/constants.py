"""Constantes configurables de la aplicación Hermes."""
import os

# --- Google Doc de contexto ---
# ID del Google Doc que contiene el contexto del tutor.
# Obligatorio: debe definirse en .env (local) o en las env vars de Netlify.
GOOGLE_DOC_ID: str = os.environ.get("CONTEXT_GOOGLE_DOC_ID", "")

# URL de exportación a texto plano. Se construye a partir de GOOGLE_DOC_ID.
GOOGLE_DOC_EXPORT_URL: str = (
    f"https://docs.google.com/document/d/{GOOGLE_DOC_ID}/export?format=txt"
)

# Segundos máximos de espera para descargar el Google Doc.
FETCH_TIMEOUT_SECONDS: int = 5

# --- Prompt builder ---
# Caracteres máximos del email de entrada antes de truncar.
MAX_BODY_CHARS: int = 6000
