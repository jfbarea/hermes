"""Orquestador del autodraft (Hito 1: sin IA, sólo lectura).

Uso local:
    python src/main.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.auth import gmail
from src.mail import reader
from src.state import last_run


def run() -> int:
    state = last_run.load()
    since = state["last_run_utc"]
    print(f"[autodraft] Última ejecución: {since}")

    refresh_token = os.environ["GMAIL_REFRESH_TOKEN"]
    access_token, new_refresh = gmail.get_token_from_refresh(refresh_token)
    if new_refresh != refresh_token:
        print("[autodraft] AVISO: refresh token rotado. Actualiza GMAIL_REFRESH_TOKEN.")
    print("[autodraft] Token Gmail obtenido.")

    emails = reader.fetch_unread(access_token, since_iso=since)
    print(f"[autodraft] {len(emails)} correos no leídos tras filtros.")
    if emails:
        print(reader.summarize(emails))

    already = set(state.get("processed_ids", []))
    new_ids = [e.id for e in emails if e.id not in already]
    state["processed_ids"] = list(already.union(new_ids))[-500:]

    last_run.save(state)
    print(f"[autodraft] Estado actualizado. {len(new_ids)} nuevos ids.")
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
