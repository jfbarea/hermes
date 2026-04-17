"""Creación de borradores y marcado de leídos vía Gmail API."""
from __future__ import annotations

import base64
import email.message
import os

import requests

GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"


def create_draft(
    token: str,
    original,          # Email dataclass de reader.py
    body: str,
    from_address: str | None = None,
) -> str:
    """Crea un borrador de respuesta en Gmail y devuelve su ID.

    `from_address` debe ser una dirección configurada como "Enviar correo como"
    en Gmail (p.ej. la cuenta M365). Si se omite, usa GMAIL_SEND_AS_ADDRESS
    o GMAIL_USER_EMAIL.
    """
    from_address = (
        from_address
        or os.environ.get("GMAIL_SEND_AS_ADDRESS")
        or os.environ["GMAIL_USER_EMAIL"]
    )

    subject = original.subject or ""
    if not subject.lower().startswith("re:"):
        subject = f"Re: {subject}"

    msg = email.message.EmailMessage()
    msg["From"] = from_address
    msg["To"] = (
        f"{original.sender_name} <{original.sender_email}>"
        if original.sender_name
        else original.sender_email
    )
    msg["Subject"] = subject
    if original.message_id:
        msg["In-Reply-To"] = original.message_id
        msg["References"] = original.message_id
    msg.set_content(body)

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")

    resp = requests.post(
        f"{GMAIL_BASE}/drafts",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json={"message": {"raw": raw, "threadId": original.thread_id}},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["id"]


def mark_as_read(token: str, message_id: str) -> None:
    """Elimina la etiqueta UNREAD del mensaje."""
    resp = requests.post(
        f"{GMAIL_BASE}/messages/{message_id}/modify",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json={"removeLabelIds": ["UNREAD"]},
        timeout=30,
    )
    resp.raise_for_status()
