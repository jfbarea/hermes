"""Netlify Function: recibe el texto de un email y devuelve un borrador de respuesta."""
from __future__ import annotations

import json
import os

import anthropic

from prompt_builder import build_prompt

MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 1024


def handler(event, context):
    # CORS preflight
    if event.get("httpMethod") == "OPTIONS":
        return {
            "statusCode": 204,
            "headers": _cors_headers(),
            "body": "",
        }

    if event.get("httpMethod") != "POST":
        return _error(405, "Method not allowed")

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _error(400, "Invalid JSON body")

    email_text = (body.get("email_text") or "").strip()
    if not email_text:
        return _error(400, "El campo email_text es obligatorio")

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return _error(500, "ANTHROPIC_API_KEY no configurada")

    try:
        system_message, user_message, context_source = build_prompt(email_text)
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=system_message,
            messages=[{"role": "user", "content": user_message}],
        )
        draft = response.content[0].text
    except anthropic.APIError as e:
        return _error(502, f"Error en la API de Anthropic: {e}")
    except Exception as e:
        return _error(500, f"Error interno: {e}")

    return {
        "statusCode": 200,
        "headers": {**_cors_headers(), "Content-Type": "application/json"},
        "body": json.dumps({"draft": draft, "context_source": context_source}),
    }


def _cors_headers() -> dict:
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
    }


def _error(status: int, message: str) -> dict:
    return {
        "statusCode": status,
        "headers": {**_cors_headers(), "Content-Type": "application/json"},
        "body": json.dumps({"error": message}),
    }
