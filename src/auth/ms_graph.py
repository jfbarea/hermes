"""OAuth2 delegado (authorization code + refresh token) para Microsoft Graph.

Flujo de un solo uso (obtener refresh token):
    python scripts/get_refresh_token.py

Flujo de producción (GitHub Actions):
    token = get_token_from_refresh(refresh_token)
"""
from __future__ import annotations

import os
import requests

GRAPH_SCOPE = "https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.ReadWrite offline_access"
TOKEN_URL_TMPL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"


def get_token_from_refresh(
    refresh_token: str,
    tenant_id: str | None = None,
    client_id: str | None = None,
    client_secret: str | None = None,
) -> tuple[str, str]:
    """Intercambia un refresh token por un nuevo access token.

    Returns:
        (access_token, new_refresh_token)
    """
    tenant_id = tenant_id or os.environ["MS_TENANT_ID"]
    client_id = client_id or os.environ["MS_CLIENT_ID"]
    client_secret = client_secret or os.environ["MS_CLIENT_SECRET"]

    resp = requests.post(
        TOKEN_URL_TMPL.format(tenant=tenant_id),
        data={
            "grant_type": "refresh_token",
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
            "scope": GRAPH_SCOPE,
        },
        timeout=30,
    )
    resp.raise_for_status()
    body = resp.json()
    return body["access_token"], body.get("refresh_token", refresh_token)
