"""Script de un solo uso para obtener el refresh token de Gmail.

Uso:
    pip install -r requirements.txt
    set -a && source .env && set +a
    python scripts/get_refresh_token.py

El script abre el navegador para que inicies sesión con tu cuenta Gmail
y luego imprime el refresh token que debes guardar como GMAIL_REFRESH_TOKEN.
"""
from __future__ import annotations

import http.server
import json
import os
import threading
import urllib.parse
import webbrowser

import requests

REDIRECT_PORT = 8080
REDIRECT_URI = f"http://localhost:{REDIRECT_PORT}"
SCOPES = "https://www.googleapis.com/auth/gmail.modify"
AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"


def _build_auth_url(client_id: str) -> str:
    params = urllib.parse.urlencode({
        "client_id": client_id,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": SCOPES,
        "access_type": "offline",   # necesario para obtener refresh_token
        "prompt": "consent",        # fuerza que Google devuelva siempre refresh_token
    })
    return f"{AUTH_URL}?{params}"


def _exchange_code(client_id: str, client_secret: str, code: str) -> dict:
    resp = requests.post(
        TOKEN_URL,
        data={
            "grant_type": "authorization_code",
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "redirect_uri": REDIRECT_URI,
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def main() -> None:
    client_id = os.environ["GMAIL_CLIENT_ID"]
    client_secret = os.environ["GMAIL_CLIENT_SECRET"]

    code_holder: list[str] = []

    class _Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            parsed = urllib.parse.urlparse(self.path)
            params = urllib.parse.parse_qs(parsed.query)
            if "code" in params:
                code_holder.append(params["code"][0])
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b"<h2>Autorizacion completada. Puedes cerrar esta ventana.</h2>")
            else:
                error = params.get("error", ["desconocido"])[0]
                self.send_response(400)
                self.end_headers()
                self.wfile.write(f"<h2>Error: {error}</h2>".encode())

        def log_message(self, *_) -> None:
            pass

    server = http.server.HTTPServer(("localhost", REDIRECT_PORT), _Handler)
    thread = threading.Thread(target=server.handle_request, daemon=True)
    thread.start()

    url = _build_auth_url(client_id)
    print(f"\nAbriendo el navegador para autenticación con Google...\n")
    print(f"Si no se abre automáticamente, copia esta URL en el navegador:\n{url}\n")
    webbrowser.open(url)

    thread.join(timeout=120)
    server.server_close()

    if not code_holder:
        print("ERROR: no se recibió el código en 120 segundos.")
        raise SystemExit(1)

    tokens = _exchange_code(client_id, client_secret, code_holder[0])
    refresh_token = tokens.get("refresh_token")

    if not refresh_token:
        print("\nERROR: Google no devolvió refresh_token.")
        print("Asegúrate de que en el Paso 2 del README usaste access_type=offline")
        print("y de que la app NO tiene ya consentimiento previo para esta cuenta.")
        print("Si ya lo tenía, revoca el acceso en https://myaccount.google.com/permissions y repite.")
        raise SystemExit(1)

    print("\n" + "=" * 60)
    print("REFRESH TOKEN — guarda esto como GitHub Secret GMAIL_REFRESH_TOKEN")
    print("=" * 60)
    print(refresh_token)
    print("=" * 60)
    print(f"\nAccess token (solo para pruebas inmediatas):\n{tokens['access_token']}\n")


if __name__ == "__main__":
    main()
