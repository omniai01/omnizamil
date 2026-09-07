"""Optional Supabase REST sync. No-ops when URL/key missing."""
from __future__ import annotations

import hashlib
import json
import os
import platform
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ENV_PATH = ROOT / ".env"
APP_VERSION = "1.6.0"


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

_heartbeat_stop = threading.Event()
_heartbeat_thread: threading.Thread | None = None
_hwid_cache: str | None = None


def supabase_config() -> tuple[str, str]:
    url = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
    key = os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("SUPABASE_KEY") or ""
    return url, key


def is_configured() -> bool:
    url, key = supabase_config()
    return bool(url and key)


def device_hwid() -> str:
    global _hwid_cache
    if _hwid_cache:
        return _hwid_cache
    raw = "|".join(
        [
            platform.node() or "",
            platform.system() or "",
            platform.machine() or "",
            os.environ.get("COMPUTERNAME") or "",
            os.environ.get("USERNAME") or "",
        ]
    )
    _hwid_cache = "sv-" + hashlib.sha256(raw.encode("utf-8", errors="ignore")).hexdigest()[:24]
    return _hwid_cache


def _detect_country() -> tuple[str, str]:
    try:
        import datetime as _dt

        tz = str(getattr(_dt.datetime.now().astimezone().tzinfo, "key", "") or "")
    except Exception:
        tz = ""
    if not tz:
        try:
            tz = time.tzname[0] if time.tzname else ""
        except Exception:
            tz = ""
    mapping = (
        (("karachi", "pakistan", "asia/karachi"), "Pakistan", "PK"),
        (("kolkata", "calcutta", "india", "asia/kolkata"), "India", "IN"),
        (("dubai", "muscat", "asia/dubai"), "United Arab Emirates", "AE"),
        (("riyadh", "asia/riyadh"), "Saudi Arabia", "SA"),
        (("dhaka", "asia/dhaka"), "Bangladesh", "BD"),
        (("london", "europe/london"), "United Kingdom", "GB"),
        (("new_york", "chicago", "los_angeles", "denver", "toronto", "vancouver"), "United States", "US"),
    )
    low = (tz or "").lower()
    for keys, name, code in mapping:
        if any(k in low for k in keys):
            return name, code
    return (tz.split("/")[-1] if "/" in tz else "Unknown") or "Unknown", ""


def _request(
    method: str,
    path: str,
    *,
    body: dict | list | None = None,
    prefer: str = "return=minimal",
    params: dict | None = None,
) -> dict:
    url, key = supabase_config()
    if not url or not key:
        return {"ok": False, "skipped": True, "message": "Supabase not configured"}
    qs = f"?{urllib.parse.urlencode(params)}" if params else ""
    endpoint = f"{url}/rest/v1/{path.lstrip('/')}{qs}"
    data = None if body is None else json.dumps(body).encode("utf-8")
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": prefer,
    }
    if method.upper() == "GET":
        headers.pop("Prefer", None)
        if prefer:
            headers["Prefer"] = prefer
    req = urllib.request.Request(endpoint, data=data, method=method.upper(), headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            raw = resp.read().decode("utf-8", errors="ignore")
            parsed = json.loads(raw) if raw.strip() else None
            return {"ok": True, "status": getattr(resp, "status", 200), "data": parsed}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="ignore")[:400]
        return {"ok": False, "message": f"HTTP {e.code}: {err_body}"}
    except Exception as e:
        return {"ok": False, "message": str(e)}


def _rpc(name: str, payload: dict) -> dict:
    url, key = supabase_config()
    if not url or not key:
        return {"ok": False, "skipped": True, "message": "Supabase not configured"}
    endpoint = f"{url}/rest/v1/rpc/{name}"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        endpoint,
        data=data,
        method="POST",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            raw = resp.read().decode("utf-8", errors="ignore")
            parsed = json.loads(raw) if raw.strip() else None
            return {"ok": True, "status": getattr(resp, "status", 200), "data": parsed}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="ignore")[:400]
        return {"ok": False, "message": f"HTTP {e.code}: {err_body}"}
    except Exception as e:
        return {"ok": False, "message": str(e)}


def push_row(table: str, row: dict) -> dict:
    return _request("POST", table, body=row)


def register_device(display_name: str = "", app_version: str = APP_VERSION) -> dict:
    if not is_configured():
        return {"ok": False, "skipped": True}
    hwid = device_hwid()
    country, country_code = _detect_country()
    row = {
        "hwid": hwid,
        "display_name": display_name or platform.node() or "ShiftVoice",
        "user_alias": display_name or platform.node() or "ShiftVoice",
        "os": f"{platform.system()} {platform.release()}".strip(),
        "cpu": platform.processor() or platform.machine() or "",
        "ram_gb": 0,
        "gpu": "",
        "app_version": app_version or APP_VERSION,
        "country": country,
        "country_code": country_code,
        "status": "active",
        "last_ping": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    existing = _request(
        "GET",
        "sv_devices",
        prefer="return=representation",
        params={"hwid": f"eq.{hwid}", "select": "hwid"},
    )
    is_new = not (isinstance(existing.get("data"), list) and existing["data"])
    res = _request(
        "POST",
        "sv_devices",
        body=row,
        prefer="resolution=merge-duplicates,return=minimal",
        params={"on_conflict": "hwid"},
    )
    if res.get("ok") and is_new:
        _request(
            "POST",
            "sv_usage_events",
            body={
                "hwid": hwid,
                "event_type": "register",
                "meta": {"displayName": row["display_name"], "country": country},
            },
        )
    return res


def heartbeat(display_name: str = "") -> dict:
    if not is_configured():
        return {"ok": False, "skipped": True}
    hwid = device_hwid()
    patch: dict = {
        "last_ping": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "status": "active",
    }
    if display_name:
        patch["display_name"] = display_name
        patch["user_alias"] = display_name
    return _request(
        "PATCH",
        "sv_devices",
        body=patch,
        params={"hwid": f"eq.{hwid}"},
    )


def bump_tts(
    *,
    chars: int = 0,
    exports: int = 0,
    success: bool = True,
    elapsed_ms: int = 0,
    display_name: str = "",
    kind: str = "tts",
    meta: dict | None = None,
) -> dict:
    if not is_configured():
        return {"ok": False, "skipped": True}
    return _rpc(
        "sv_bump_tts",
        {
            "p_hwid": device_hwid(),
            "p_chars": int(chars or 0),
            "p_exports": int(exports or 0),
            "p_success": bool(success),
            "p_elapsed_ms": int(elapsed_ms or 0),
            "p_display_name": display_name or platform.node() or "ShiftVoice",
            "p_kind": kind or "tts",
            "p_meta": meta or {},
        },
    )


def report_error(
    message: str,
    *,
    error_type: str = "ENGINE",
    severity: str = "warning",
    stack_trace: str = "",
    display_name: str = "",
) -> dict:
    if not is_configured() or not (message or "").strip():
        return {"ok": False, "skipped": True}
    return push_row(
        "sv_error_logs",
        {
            "hwid": device_hwid(),
            "user_alias": display_name or platform.node() or "ShiftVoice",
            "error_type": error_type or "ENGINE",
            "message": str(message)[:2000],
            "stack_trace": str(stack_trace or "")[:4000],
            "severity": severity if severity in ("critical", "warning", "info") else "warning",
            "status": "open",
        },
    )


def fetch_app_settings() -> dict:
    if not is_configured():
        return {"ok": False, "skipped": True}
    res = _request(
        "GET",
        "sv_app_settings",
        prefer="return=representation",
        params={"id": "eq.1", "select": "*"},
    )
    if not res.get("ok"):
        return res
    data = res.get("data")
    row = data[0] if isinstance(data, list) and data else None
    return {"ok": True, "settings": row}


def start_heartbeat_loop(interval_sec: int = 60, display_name: str = "") -> None:
    global _heartbeat_thread
    if not is_configured():
        return
    if _heartbeat_thread and _heartbeat_thread.is_alive():
        return

    def _loop() -> None:
        while not _heartbeat_stop.wait(interval_sec):
            try:
                heartbeat(display_name=display_name)
            except Exception:
                pass

    _heartbeat_stop.clear()
    _heartbeat_thread = threading.Thread(target=_loop, name="sv-heartbeat", daemon=True)
    _heartbeat_thread.start()


def stop_heartbeat_loop() -> None:
    _heartbeat_stop.set()
