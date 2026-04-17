"""Persistencia del estado de la última ejecución."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

DEFAULT_PATH = Path("state/last_run.json")
FALLBACK_HOURS = 12


def _empty_state(now: datetime) -> dict[str, Any]:
    fallback = now - timedelta(hours=FALLBACK_HOURS)
    return {
        "last_run_utc": fallback.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "processed_ids": [],
        "cost_tracking": {
            "last_run_input_tokens": 0,
            "last_run_output_tokens": 0,
            "month_input_tokens": 0,
            "month_output_tokens": 0,
            "month_year": now.strftime("%Y-%m"),
        },
    }


def load(path: Path = DEFAULT_PATH) -> dict[str, Any]:
    """Lee el estado. Si no existe, devuelve fallback de 12h atrás."""
    now = datetime.now(timezone.utc)
    if not path.exists():
        return _empty_state(now)
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    # Reset mensual si ha cambiado el mes.
    ct = data.setdefault("cost_tracking", _empty_state(now)["cost_tracking"])
    current_month = now.strftime("%Y-%m")
    if ct.get("month_year") != current_month:
        ct["month_year"] = current_month
        ct["month_input_tokens"] = 0
        ct["month_output_tokens"] = 0
    data.setdefault("processed_ids", [])
    return data


def save(
    state: dict[str, Any],
    *,
    now: datetime | None = None,
    path: Path = DEFAULT_PATH,
) -> None:
    """Actualiza `last_run_utc` y escribe el fichero."""
    now = now or datetime.now(timezone.utc)
    state["last_run_utc"] = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(state, f, indent=2, ensure_ascii=False)
        f.write("\n")
