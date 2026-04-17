#!/usr/bin/env python3
"""Invoca generate.handler localmente simulando el evento de Netlify/Lambda.

Uso:
    python3 scripts/invoke_local.py "Texto del email aquí"
    python3 scripts/invoke_local.py  # usa el email de ejemplo por defecto
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

# Añade netlify/functions al path para poder importar generate y prompt_builder
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "netlify" / "functions"))

from generate import handler

DEFAULT_EMAIL = (
    "Hola, tengo dudas sobre el temario de Psicopatología. "
    "¿Qué temas son más importantes para el PIR?"
)

email_text = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else DEFAULT_EMAIL

event = {
    "httpMethod": "POST",
    "body": json.dumps({"email_text": email_text}),
    "headers": {"Content-Type": "application/json"},
}

print(f"📨 Email: {email_text[:80]}{'...' if len(email_text) > 80 else ''}\n")

response = handler(event, {})
status = response["statusCode"]
body = json.loads(response["body"])

if status == 200:
    print(f"✅ HTTP {status}\n")
    print("─" * 60)
    print(body["draft"])
    print("─" * 60)
    print(f"\n[context_source: {body.get('context_source', '?')}]")
else:
    print(f"❌ HTTP {status}: {body.get('error', body)}")
