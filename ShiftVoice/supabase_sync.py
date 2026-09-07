"""Optional Supabase REST sync. No-ops when URL/key missing."""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ENV_PATH = ROOT / ".env"


def _load_dotenv() -> None:
    if not ENV_PATH.exists():
        return
    try:
        for raw in ENV_PATH.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = val
    except Exception:
        pass


_load_dotenv()


def supabase_config() -> tuple[str, str]:
    url = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
    key = os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("SUPABASE_KEY") or ""
    return url, key


def is_configured() -> bool:
    url, key = supabase_config()
    return bool(url and key)


def push_row(table: str, row: dict) -> dict:
    url, key = supabase_config()
    if not url or not key:
        return {"ok": False, "skipped": True, "message": "Supabase not configured"}
    endpoint = f"{url}/rest/v1/{table}"
    data = json.dumps(row).encode("utf-8")
    req = urllib.request.Request(
        endpoint,
        data=data,
        method="POST",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            return {"ok": True, "status": getattr(resp, "status", 200)}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")[:400]
        return {"ok": False, "message": f"HTTP {e.code}: {body}"}
    except Exception as e:
        return {"ok": False, "message": str(e)}
