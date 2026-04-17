"""OAuth2 refresh-token flow para Gmail API.

Flujo de un solo uso (obtener refresh token):
    python scripts/get_refresh_token.py

Flujo de producción (GitHub Actions):
    access_token, new_refresh = get_token_from_refresh(...)
"""
from __future__ import annotations

import os
import requests

TOKEN_URL = "https://oauth2.googleapis.com/token"
SCOPES = "https://www.googleapis.com/auth/gmail.modify"


def get_token_from_refresh(
    refresh_token: str,
    client_id: str | None = None,
    client_secret: str | None = None,
) -> tuple[str, str]:
    """Intercambia un refresh token por un nuevo access token.

    Returns:
        (access_token, new_refresh_token)
    """
    client_id = client_id or os.environ["GMAIL_CLIENT_ID"]
    client_secret = client_secret or os.environ["GMAIL_CLIENT_SECRET"]

    resp = requests.post(
        TOKEN_URL,
        data={
            "grant_type": "refresh_token",
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
        },
        timeout=30,
    )
    resp.raise_for_status()
    body = resp.json()
    # Google no rota el refresh token por defecto, pero lo devolvemos
    # por si en algún caso viniera en la respuesta.
    return body["access_token"], body.get("refresh_token", refresh_token)
