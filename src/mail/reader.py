"""Lectura de correos no leídos vía Gmail API."""
from __future__ import annotations

import base64
import os
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Iterable

import requests

GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"


@dataclass
class Email:
    id: str
    thread_id: str
    message_id: str          # cabecera RFC-2822 Message-ID (para threading)
    subject: str
    sender_name: str
    sender_email: str
    received: str            # ISO 8601
    body_text: str
    headers: dict = field(default_factory=dict)


def _parse_headers(raw: list[dict]) -> dict:
    return {h["name"].lower(): h["value"] for h in raw}


def _is_auto_submitted(headers: dict) -> bool:
    if headers.get("auto-submitted", "no").lower() != "no":
        return True
    if "list-unsubscribe" in headers:
        return True
    if "x-mailer" in headers and "newsletter" in headers.get("x-mailer", "").lower():
        return True
    return False


def _parse_sender(from_header: str) -> tuple[str, str]:
    """Extrae (nombre, email) del campo From."""
    m = re.match(r"^(.*?)\s*<(.+?)>$", from_header.strip())
    if m:
        return m.group(1).strip().strip('"'), m.group(2).strip().lower()
    return "", from_header.strip().lower()


def _extract_text(payload: dict) -> str:
    """Extrae el cuerpo en texto plano de un payload (recursivo en multipart)."""
    mime = payload.get("mimeType", "")
    if mime == "text/plain":
        data = (payload.get("body") or {}).get("data", "")
        if data:
            return base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="replace")
    if mime.startswith("multipart/"):
        for part in payload.get("parts", []):
            text = _extract_text(part)
            if text:
                return text
    return ""


def _since_query(since_iso: str) -> str:
    """Convierte ISO timestamp en filtro de fecha para Gmail (after:YYYY/MM/DD)."""
    dt = datetime.fromisoformat(since_iso.replace("Z", "+00:00"))
    return f"after:{dt.strftime('%Y/%m/%d')}"


def fetch_unread(
    token: str,
    since_iso: str | None = None,
    user_email: str | None = None,
    max_results: int = 50,
) -> list[Email]:
    """Obtiene correos no leídos desde `since_iso`, aplicando filtros básicos."""
    user_email = (user_email or os.environ.get("GMAIL_USER_EMAIL", "")).lower()

    query_parts = ["is:unread", "in:inbox"]
    if since_iso:
        query_parts.append(_since_query(since_iso))

    headers_auth = {"Authorization": f"Bearer {token}"}

    # 1. Listar IDs
    resp = requests.get(
        f"{GMAIL_BASE}/messages",
        headers=headers_auth,
        params={"q": " ".join(query_parts), "maxResults": max_results},
        timeout=30,
    )
    resp.raise_for_status()
    items = resp.json().get("messages", [])

    # 2. Obtener detalle de cada mensaje
    out: list[Email] = []
    since_dt = (
        datetime.fromisoformat(since_iso.replace("Z", "+00:00")) if since_iso else None
    )

    for item in items:
        detail = requests.get(
            f"{GMAIL_BASE}/messages/{item['id']}",
            headers=headers_auth,
            params={"format": "full"},
            timeout=30,
        )
        detail.raise_for_status()
        msg = detail.json()

        hdrs = _parse_headers(msg.get("payload", {}).get("headers", []))

        # Filtrar por timestamp exacto (Gmail solo filtra por día)
        internal_ms = int(msg.get("internalDate", "0"))
        received_dt = datetime.fromtimestamp(internal_ms / 1000, tz=timezone.utc)
        if since_dt and received_dt <= since_dt:
            continue

        sender_name, sender_email = _parse_sender(hdrs.get("from", ""))

        # Ignorar correos propios
        if user_email and sender_email == user_email:
            continue

        # Ignorar auto-submitted / newsletters
        if _is_auto_submitted(hdrs):
            continue

        body_text = _extract_text(msg.get("payload", {}))

        out.append(
            Email(
                id=msg["id"],
                thread_id=msg.get("threadId", ""),
                message_id=hdrs.get("message-id", ""),
                subject=hdrs.get("subject", ""),
                sender_name=sender_name,
                sender_email=sender_email,
                received=received_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
                body_text=body_text,
                headers=hdrs,
            )
        )
    return out


def summarize(emails: Iterable[Email]) -> str:
    return "\n".join(f"[{e.sender_email}] {e.subject}" for e in emails)
