"""ShiftVoice — ShiftZero desktop TTS."""

from __future__ import annotations

import asyncio
import base64
import json
import os
import platform
import re
import sys
import threading
import time
import uuid
import webbrowser
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

import edge_tts
import webview

import supabase_sync

APP_VERSION = "1.6.0"
ROOT = Path(__file__).resolve().parent
WWW = ROOT / "www"
WORK = ROOT / "work"
JOBS = WORK / "jobs"
PREVIEWS = WORK / "previews"
HISTORY = WORK / "history.json"
SETTINGS = WORK / "settings.json"
LIBRARY = WORK / "library.json"
JOBS_INDEX = WORK / "jobs_index.json"
USAGE_EVENTS = WORK / "usage_events.json"
BATCHES_LOG = WORK / "batches.json"
ICON_ICO = WWW / "assets" / "shiftvoice.ico"
ICON_PNG = WWW / "assets" / "shiftvoice-logo.png"
ADMIN_ERRORS = WORK / "admin_errors.json"
ADMIN_PIN_DEFAULT = "7700"

for d in (WORK, JOBS, PREVIEWS):
    d.mkdir(parents=True, exist_ok=True)


def _safe_user_message(exc: object, fallback: str = "ShiftVoice could not complete that request. Try again in a moment.") -> str:
    """Never expose provider URLs, tokens, or third-party names to end users."""
    raw = str(exc or "")
    low = raw.lower()
    leak_markers = (
        "speech.platform",
        "bing.com",
        "edge_tts",
        "edge-tts",
        "microsoft",
        "trustedclienttoken",
        "sec-ms-gec",
        "aiohttp",
        "http://",
        "https://",
        "503",
        "502",
        "504",
        "traceback",
        "websocket",
        "clientpayloaderror",
    )
    if any(m in low for m in leak_markers) or "edge_tts" in low or "edge-tts" in low:
        if "503" in low or "unavailable" in low:
            return "ShiftVoice voices are temporarily unavailable. Please try again shortly."
        if "timeout" in low or "timed out" in low:
            return "ShiftVoice timed out. Check your internet and try again."
        if "getaddrinfo" in low or "network" in low or "offline" in low:
            return "ShiftVoice needs an internet connection for voices right now."
        return fallback
    cleaned = re.sub(r"https?://\S+", "", raw)
    cleaned = re.sub(r"[A-Fa-f0-9]{20,}", "", cleaned)
    cleaned = cleaned.strip(" ,;:-") or fallback
    if len(cleaned) > 160:
        return fallback
    return cleaned


def _append_admin_error(source: str, raw: object, user_message: str = "") -> None:
    try:
        items = _load_json(ADMIN_ERRORS, [])
        if not isinstance(items, list):
            items = []
        entry = {
            "id": uuid.uuid4().hex[:10],
            "source": source,
            "raw": str(raw)[:4000],
            "userMessage": user_message or "",
            "createdAt": _utc_now(),
            "read": False,
        }
        items.insert(0, entry)
        _save_json(ADMIN_ERRORS, items[:300])
        try:
            supabase_sync.report_error(
                user_message or str(raw)[:500],
                error_type=str(source or "ENGINE")[:40],
                severity="warning",
                stack_trace=str(raw)[:4000],
            )
        except Exception:
            pass
    except Exception:
        pass


def _public_fail(source: str, exc: object, fallback: str | None = None) -> dict:
    user_msg = _safe_user_message(
        exc, fallback or "ShiftVoice could not complete that request. Try again in a moment."
    )
    _append_admin_error(source, exc, user_msg)
    return {"ok": False, "message": user_msg}



def _find_ffmpeg() -> str | None:
    import shutil

    return shutil.which("ffmpeg")


def _find_ffprobe() -> str | None:
    import shutil

    probe = shutil.which("ffprobe")
    if probe:
        return probe
    ff = _find_ffmpeg()
    if not ff:
        return None
    sibling = Path(ff).with_name("ffprobe.exe" if sys.platform == "win32" else "ffprobe")
    return str(sibling) if sibling.exists() else None


def _configure_pydub() -> dict:
    """Wire pydub to a local ffmpeg if present. Returns status dict."""
    try:
        from pydub import AudioSegment
    except Exception as e:
        return {"ok": False, "pydub": False, "ffmpeg": False, "message": f"Audio tools not ready ({e})"}
    ff = _find_ffmpeg()
    if not ff:
        return {
            "ok": False,
            "pydub": True,
            "ffmpeg": False,
            "message": "ShiftVoice audio tools need the local audio engine on this PC.",
        }
    AudioSegment.converter = ff
    probe = _find_ffprobe()
    if probe:
        AudioSegment.ffprobe = probe
    return {"ok": True, "pydub": True, "ffmpeg": True, "ffmpegPath": ff, "message": "ShiftVoice audio tools ready"}


def _strip_silence_file(src: Path, keep_ms: int = 50) -> Path:
    cfg = _configure_pydub()
    if not cfg.get("ok"):
        raise RuntimeError(cfg.get("message") or "Audio tools not ready")
    from pydub import AudioSegment
    from pydub.silence import split_on_silence

    sound = AudioSegment.from_file(str(src))
    keep = max(0, int(keep_ms))
    chunks = split_on_silence(
        sound,
        min_silence_len=100,
        silence_thresh=-45,
        keep_silence=keep,
    )
    if not chunks:
        dynamic_thresh = sound.dBFS - 16
        chunks = split_on_silence(
            sound,
            min_silence_len=100,
            silence_thresh=dynamic_thresh,
            keep_silence=keep,
        )
    combined = AudioSegment.empty()
    for chunk in chunks:
        combined += chunk
    if len(combined) == 0:
        combined = sound
    out = src.with_name(f"{src.stem}_nosilence{src.suffix or '.mp3'}")
    fmt = (src.suffix or ".mp3").lstrip(".").lower() or "mp3"
    combined.export(str(out), format=fmt)
    return out



def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def _save_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def _run(coro):
    return asyncio.run(coro)


def _b64_audio(path: Path) -> str:
    return "data:audio/mpeg;base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def _split_text_chunks(text: str, max_chars: int = 700) -> list[str]:
    """Split long scripts into sentence-ish chunks for parallel TTS."""
    text = (text or "").strip()
    if not text:
        return []
    if len(text) <= max_chars:
        return [text]

    parts: list[str] = []
    buf = ""
    # Prefer sentence boundaries, then spaces
    import re

    pieces = re.split(r"(?<=[.!?。！？])\s+", text)
    for piece in pieces:
        piece = piece.strip()
        if not piece:
            continue
        if len(piece) > max_chars:
            # hard-wrap long sentences
            words = piece.split()
            cur = ""
            for w in words:
                trial = f"{cur} {w}".strip()
                if len(trial) > max_chars and cur:
                    parts.append(cur)
                    cur = w
                else:
                    cur = trial
            if cur:
                parts.append(cur)
            continue
        trial = f"{buf} {piece}".strip()
        if len(trial) > max_chars and buf:
            parts.append(buf)
            buf = piece
        else:
            buf = trial
    if buf:
        parts.append(buf)
    return parts or [text]


async def _synth_one(
    text: str,
    voice: str,
    rate: str,
    pitch: str,
    volume: str,
    out: Path,
    sem: asyncio.Semaphore,
) -> Path:
    async with sem:
        communicate = edge_tts.Communicate(
            text, voice, rate=rate, pitch=pitch, volume=volume
        )
        await communicate.save(str(out))
        return out


async def _synthesize_fast(
    text: str,
    voice: str,
    rate: str,
    pitch: str,
    volume: str,
    out: Path,
    concurrency: int = 14,
    on_progress=None,
) -> None:
    chunks = _split_text_chunks(text, max_chars=650)
    if len(chunks) == 1:
        communicate = edge_tts.Communicate(
            text, voice, rate=rate, pitch=pitch, volume=volume
        )
        await communicate.save(str(out))
        if on_progress:
            on_progress(1.0)
        return

    sem = asyncio.Semaphore(concurrency)
    tmp_dir = out.parent / f"_chunks_{out.stem}"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    paths = [tmp_dir / f"{i:04d}.mp3" for i in range(len(chunks))]
    done = 0
    total = len(chunks)

    async def run_one(i: int, chunk: str):
        nonlocal done
        await _synth_one(chunk, voice, rate, pitch, volume, paths[i], sem)
        done += 1
        if on_progress:
            on_progress(done / total)

    await asyncio.gather(*[run_one(i, c) for i, c in enumerate(chunks)])
    with open(out, "wb") as dest:
        for p in paths:
            dest.write(p.read_bytes())
    # cleanup
    try:
        for p in paths:
            p.unlink(missing_ok=True)
        tmp_dir.rmdir()
    except Exception:
        pass


def _emit_progress(payload: dict) -> None:
    try:
        if webview.windows:
            webview.windows[0].evaluate_js(
                f"window.__shiftvoiceProgress && window.__shiftvoiceProgress({json.dumps(payload)})"
            )
    except Exception:
        pass


def _emit_job(payload: dict) -> None:
    try:
        if webview.windows:
            webview.windows[0].evaluate_js(
                f"window.__shiftvoiceJobUpdate && window.__shiftvoiceJobUpdate({json.dumps(payload)})"
            )
    except Exception:
        pass


def _read_script_file(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in {".txt", ".md", ".csv", ".log"}:
        return path.read_text(encoding="utf-8", errors="ignore")
    if suffix == ".docx":
        with zipfile.ZipFile(path) as zf:
            xml = zf.read("word/document.xml")
        root = ET.fromstring(xml)
        texts = []
        for node in root.iter():
            if node.tag.endswith("}t") and node.text:
                texts.append(node.text)
            if node.tag.endswith("}p"):
                texts.append("\n")
        return "".join(texts)
    raise ValueError("Use .txt, .md, or .docx")


def _maybe_audio(path: Path) -> str | None:
    """Avoid huge base64 payloads for long exports (UI crash)."""
    try:
        if path.stat().st_size <= 2_500_000:
            return _b64_audio(path)
    except Exception:
        return None
    return None



class Api:
    def __init__(self) -> None:
        saved = _load_json(SETTINGS, {})
        default_out = str(Path.home() / "Documents" / "ShiftVoice")
        self.output_dir = saved.get("outputDir") or default_out
        self.chars_generated = int(saved.get("charsGenerated") or 0)
        self.exports_count = int(saved.get("exportsCount") or 0)
        self.batches_count = int(saved.get("batchesCount") or 0)
        self.admin_pin = str(saved.get("adminPin") or ADMIN_PIN_DEFAULT)
        self.maintenance_mode = bool(saved.get("maintenanceMode") or False)
        self._cloud_chars_aligned = bool(saved.get("cloudCharsAligned") or False)
        Path(self.output_dir).mkdir(parents=True, exist_ok=True)
        self._voices_cache: list | None = None
        lib = _load_json(LIBRARY, {"favorites": [], "pairs": []})
        self.favorites = list(lib.get("favorites") or [])
        self.pairs = list(lib.get("pairs") or [])
        self._job_lock = threading.Lock()
        self._jobs = _load_json(JOBS_INDEX, [])
        self._usage_events = _load_json(USAGE_EVENTS, [])
        self._batches = _load_json(BATCHES_LOG, [])
        changed = False
        for job in self._jobs:
            if job.get("status") in ("queued", "running"):
                job["status"] = "failed"
                job["error"] = "Interrupted by app restart"
                job["progress"] = 0
                job["updatedAt"] = _utc_now()
                changed = True
        if changed:
            self._persist_jobs()
        self._cloud_maintenance = False
        self._cloud_maintenance_message = ""
        self._boot_cloud()

    def _boot_cloud(self) -> None:
        """Register with Omni admin cloud (sv_*). Never breaks local app if offline."""

        def _run() -> None:
            try:
                if not supabase_sync.is_configured():
                    return
                name = platform.node() or "ShiftVoice"
                supabase_sync.register_device(display_name=name, app_version=APP_VERSION)
                supabase_sync.start_heartbeat_loop(60, display_name=name)
                self._refresh_cloud_settings()
                self._align_cloud_chars_once()
            except Exception:
                pass

        threading.Thread(target=_run, name="sv-cloud-boot", daemon=True).start()

    def _align_cloud_chars_once(self) -> None:
        """One-shot: push local chars/exports if cloud still shows 0 for this device."""
        try:
            saved = _load_json(SETTINGS, {})
            if saved.get("cloudCharsAligned"):
                self._cloud_chars_aligned = True
                return
            if self.chars_generated <= 0 and self.exports_count <= 0:
                return
            hwid = supabase_sync.device_hwid()
            existing = supabase_sync._request(
                "GET",
                "sv_devices",
                prefer="return=representation",
                params={"hwid": f"eq.{hwid}", "select": "image_count,video_count"},
            )
            rows = existing.get("data") if isinstance(existing, dict) else None
            row = rows[0] if isinstance(rows, list) and rows else {}
            cloud_chars = int((row or {}).get("image_count") or 0)
            cloud_exports = int((row or {}).get("video_count") or 0)
            if cloud_chars > 0 or cloud_exports > 0:
                self._cloud_chars_aligned = True
                self._persist_settings()
                return
            chars = max(0, int(self.chars_generated) - cloud_chars)
            exports = max(0, int(self.exports_count) - cloud_exports)
            if chars <= 0 and exports <= 0:
                return
            supabase_sync.bump_tts(
                chars=chars,
                exports=exports,
                success=True,
                display_name=platform.node() or "ShiftVoice",
                kind="align",
                meta={"source": "local_settings_align"},
            )
            self._cloud_chars_aligned = True
            self._persist_settings()
        except Exception:
            pass

    def _refresh_cloud_settings(self) -> None:
        try:
            res = supabase_sync.fetch_app_settings()
            settings = (res or {}).get("settings") if isinstance(res, dict) else None
            if not isinstance(settings, dict):
                return
            enabled = bool(settings.get("maintenance_enabled"))
            affect_all = settings.get("affect_all_devices", True)
            allowed = settings.get("allowed_hwids") or []
            hwid = supabase_sync.device_hwid()
            if enabled and (affect_all or hwid in (allowed or [])):
                self._cloud_maintenance = True
                self._cloud_maintenance_message = str(
                    settings.get("maintenance_message")
                    or "ShiftVoice is under maintenance. Please try again later."
                )
            else:
                self._cloud_maintenance = False
                self._cloud_maintenance_message = ""
        except Exception:
            pass

    def _is_maintenance(self) -> bool:
        return bool(self.maintenance_mode or self._cloud_maintenance)

    def _maintenance_message(self) -> str:
        if self._cloud_maintenance and self._cloud_maintenance_message:
            return self._cloud_maintenance_message
        return "ShiftVoice is in maintenance. Please try again soon."

    def _persist_jobs(self) -> None:
        _save_json(JOBS_INDEX, self._jobs[:300])

    def _persist_usage_events(self) -> None:
        _save_json(USAGE_EVENTS, self._usage_events[:500])

    def _persist_batches(self) -> None:
        _save_json(BATCHES_LOG, self._batches[:200])

    def _push_supabase(self, table: str, row: dict) -> None:
        try:
            supabase_sync.push_row(table, row)
        except Exception:
            pass

    def _log_usage_event(
        self,
        kind: str,
        chars: int = 0,
        job_id: str = "",
        title: str = "",
        meta: dict | None = None,
        elapsed_ms: int = 0,
    ) -> None:
        event = {
            "id": uuid.uuid4().hex[:12],
            "kind": kind,
            "chars": int(chars or 0),
            "exports": 1 if kind in ("studio", "podcast", "export", "silence", "batch") else 0,
            "job_id": job_id or "",
            "title": (title or "")[:120],
            "meta": meta or {},
            "created_at": _utc_now(),
        }
        self._usage_events.insert(0, event)
        self._persist_usage_events()
        self._push_supabase(
            "shiftvoice_usage",
            {
                "id": event["id"],
                "kind": event["kind"],
                "chars": event["chars"],
                "exports": event["exports"],
                "job_id": event["job_id"],
                "title": event["title"],
                "meta": event["meta"],
                "created_at": event["created_at"],
            },
        )
        try:
            supabase_sync.bump_tts(
                chars=int(event["chars"] or 0),
                exports=int(event["exports"] or 0),
                success=True,
                elapsed_ms=int(elapsed_ms or 0),
                display_name=platform.node() or "ShiftVoice",
                kind=str(kind or "tts"),
                meta={
                    "job_id": event["job_id"],
                    "title": event["title"],
                    **(event["meta"] if isinstance(event["meta"], dict) else {}),
                },
            )
        except Exception:
            pass

    def _push_job_cloud(self, job: dict) -> None:
        try:
            self._push_supabase(
                "shiftvoice_jobs",
                {
                    "id": job.get("id") or "",
                    "kind": job.get("kind") or "studio",
                    "status": job.get("status") or "",
                    "title": (job.get("title") or "")[:120],
                    "chars": int(job.get("chars") or 0),
                    "path": job.get("path") or "",
                    "created_at": job.get("createdAt"),
                    "updated_at": job.get("updatedAt") or _utc_now(),
                },
            )
        except Exception:
            pass

    def _upsert_job(self, job: dict) -> dict:
        with self._job_lock:
            found = False
            prev_status = None
            for i, existing in enumerate(self._jobs):
                if existing.get("id") == job.get("id"):
                    prev_status = existing.get("status")
                    self._jobs[i] = job
                    found = True
                    break
            if not found:
                self._jobs.insert(0, job)
            self._persist_jobs()
        _emit_job({"type": "job", "job": job})
        _emit_progress(
            {
                "phase": "line" if job.get("status") == "running" else job.get("status"),
                "progress": job.get("progress") or 0,
                "label": job.get("label") or job.get("status"),
                "jobId": job.get("id"),
            }
        )
        status = job.get("status")
        progress = float(job.get("progress") or 0)
        should_push = status in ("queued", "done", "failed") or (
            status == "running" and (prev_status != "running" or progress <= 0.08)
        )
        if should_push and job.get("id"):
            self._push_job_cloud(job)
        return job

    def list_jobs(self, query: str = "") -> dict:
        q = (query or "").strip().lower()
        with self._job_lock:
            items = list(self._jobs)
        if q:
            items = [
                j
                for j in items
                if q in (j.get("title") or "").lower()
                or q in (j.get("id") or "").lower()
                or q in (j.get("status") or "").lower()
                or q in (j.get("kind") or "").lower()
            ]
        return {"ok": True, "jobs": items}

    def get_job(self, job_id: str) -> dict:
        with self._job_lock:
            for job in self._jobs:
                if job.get("id") == job_id:
                    return {"ok": True, "job": job}
        return {"ok": False, "message": "Job not found"}

    def pick_script_file(self) -> dict:
        result = webview.windows[0].create_file_dialog(
            webview.OPEN_DIALOG,
            allow_multiple=False,
            file_types=("Text Files (*.txt;*.md;*.docx)",),
        )
        if not result:
            return {"ok": False, "message": "No file selected"}
        path = Path(result[0] if isinstance(result, (list, tuple)) else result)
        try:
            text = _read_script_file(path)
            return {"ok": True, "text": text, "name": path.name, "path": str(path)}
        except Exception as e:
            return _public_fail("pick_script_file", e, "Could not read that script file.")
        result = webview.windows[0].create_file_dialog(
            webview.OPEN_DIALOG,
            allow_multiple=True,
            file_types=("Text Files (*.txt;*.md;*.docx)",),
        )
        if not result:
            return {"ok": False, "message": "No files selected", "files": []}
        paths = result if isinstance(result, (list, tuple)) else [result]
        files = []
        errors = []
        for raw in paths:
            path = Path(raw)
            try:
                text = _read_script_file(path)
                files.append({"text": text, "name": path.name, "path": str(path)})
            except Exception as e:
                errors.append(f"{path.name}: {e}")
        if not files:
            return {"ok": False, "message": "; ".join(errors) or "No files loaded", "files": []}
        return {"ok": True, "files": files, "errors": errors}

    def get_usage_stats(self) -> dict:
        with self._job_lock:
            jobs = list(self._jobs)
        done = sum(1 for j in jobs if j.get("status") == "done")
        failed = sum(1 for j in jobs if j.get("status") == "failed")
        studio = sum(1 for j in jobs if j.get("kind") == "studio")
        podcast = sum(1 for j in jobs if j.get("kind") == "podcast")
        saved_usd = (self.chars_generated / 1_000_000.0) * 15.0
        return {
            "ok": True,
            "charsGenerated": self.chars_generated,
            "exportsCount": self.exports_count,
            "batchesCount": self.batches_count,
            "moneySaved": round(saved_usd, 4),
            "jobsDone": done,
            "jobsFailed": failed,
            "jobsStudio": studio,
            "jobsPodcast": podcast,
            "events": self._usage_events[:40],
            "batches": self._batches[:20],
            "supabaseConfigured": supabase_sync.is_configured(),
            "supabaseMessage": (
                "Supabase connected — events sync on generate."
                if supabase_sync.is_configured()
                else "Add SUPABASE_URL + SUPABASE_ANON_KEY in .env to sync (see .env.example)."
            ),
        }

    def enqueue_batch(self, payload: dict) -> dict:
        if self._is_maintenance():
            return {
                "ok": False,
                "message": self._maintenance_message(),
                "maintenance": True,
            }
        if isinstance(payload, str):
            try:
                payload = json.loads(payload)
            except Exception:
                return {"ok": False, "message": "Invalid payload"}
        mode = (payload or {}).get("mode") or "studio"
        items = (payload or {}).get("items") or []
        rate = (payload or {}).get("rate", "+0%")
        pitch = (payload or {}).get("pitch", "+0Hz")
        volume = (payload or {}).get("volume", "+0%")
        if not items:
            return {"ok": False, "message": "Add at least one script."}

        jobs = []
        errors = []
        total_chars = 0
        for i, item in enumerate(items):
            name = (item.get("name") or f"Script {i + 1}").strip()
            try:
                if mode == "podcast":
                    result = self.generate_podcast(
                        {
                            "lines": item.get("lines") or [],
                            "rate": rate,
                            "pitch": pitch,
                            "volume": volume,
                        }
                    )
                else:
                    result = self.generate_audio(
                        {
                            "text": item.get("text") or "",
                            "voice": item.get("voice") or "",
                            "rate": rate,
                            "pitch": pitch,
                            "volume": volume,
                        }
                    )
                if not result.get("ok"):
                    errors.append(f"{name}: {result.get('message') or 'failed'}")
                    continue
                job = result.get("job") or {}
                if name and job.get("id"):
                    job["title"] = f"{name} · {job.get('title') or ''}"[:80]
                    self._upsert_job(job)
                jobs.append(job)
                total_chars += int(job.get("chars") or 0)
            except Exception as e:
                errors.append(f"{name}: {e}")

        if not jobs:
            return {"ok": False, "message": "; ".join(errors) or "Nothing queued", "jobs": []}

        batch_id = uuid.uuid4().hex[:10]
        batch = {
            "id": batch_id,
            "mode": mode,
            "item_count": len(jobs),
            "chars": total_chars,
            "job_ids": [j.get("id") for j in jobs],
            "created_at": _utc_now(),
            "errors": errors,
        }
        self._batches.insert(0, batch)
        self._persist_batches()
        self.batches_count += 1
        self._persist_settings()
        self._log_usage_event(
            "batch",
            chars=total_chars,
            title=f"Batch {mode} · {len(jobs)} jobs",
            meta={"batch_id": batch_id, "mode": mode, "count": len(jobs)},
        )
        self._push_supabase(
            "shiftvoice_batches",
            {
                "id": batch_id,
                "mode": mode,
                "item_count": len(jobs),
                "chars": total_chars,
                "job_ids": batch["job_ids"],
                "created_at": batch["created_at"],
            },
        )
        return {"ok": True, "batch": batch, "jobs": jobs, "errors": errors, "count": len(jobs)}

    def _persist_settings(self) -> None:
        saved = _load_json(SETTINGS, {})
        _save_json(
            SETTINGS,
            {
                "outputDir": self.output_dir,
                "charsGenerated": self.chars_generated,
                "exportsCount": self.exports_count,
                "batchesCount": self.batches_count,
                "adminPin": self.admin_pin,
                "maintenanceMode": self.maintenance_mode,
                "cloudCharsAligned": bool(
                    getattr(self, "_cloud_chars_aligned", False)
                    or saved.get("cloudCharsAligned")
                ),
            },
        )

    def _persist_library(self) -> None:
        _save_json(LIBRARY, {"favorites": self.favorites, "pairs": self.pairs})

    def _track_usage(
        self,
        text: str,
        kind: str = "export",
        job_id: str = "",
        title: str = "",
        *,
        voice: str = "",
        voices: list | None = None,
        elapsed_ms: int = 0,
        meta: dict | None = None,
        count_export: bool = True,
        count_chars: bool = True,
    ) -> None:
        if count_chars:
            self.chars_generated += len(text or "")
        if count_export:
            self.exports_count += 1
        self._persist_settings()
        extra = dict(meta or {})
        if voice:
            extra["voice"] = voice
        if voices:
            extra["voices"] = list(voices)[:12]
        self._log_usage_event(
            kind,
            chars=len(text or "") if count_chars else 0,
            job_id=job_id,
            title=title,
            meta=extra,
            elapsed_ms=elapsed_ms,
        )

    def check_internet(self) -> dict:
        try:
            import urllib.request

            urllib.request.urlopen("https://www.bing.com", timeout=5)
            return {"ok": True, "online": True}
        except Exception as e:
            return {"ok": False, "online": False, "message": str(e)}

    def get_dashboard(self) -> dict:
        # Commercial neural TTS often ~$15 / 1M chars → user saves that at $0.
        hist = _load_json(HISTORY, [])
        hist_chars = 0
        if isinstance(hist, list):
            for row in hist:
                hist_chars += int(row.get("chars") or 0)
        chars = max(int(self.chars_generated or 0), hist_chars)
        if chars > self.chars_generated:
            self.chars_generated = chars
            self._persist_settings()
        saved_usd = (chars / 1_000_000.0) * 15.0
        return {
            "ok": True,
            "version": APP_VERSION,
            "charsGenerated": chars,
            "exportsCount": self.exports_count,
            "moneySaved": round(saved_usd, 4),
            "favorites": len(self.favorites),
            "pairs": len(self.pairs),
            "batchesCount": self.batches_count,
            "outputDir": self.output_dir,
            "supabaseConfigured": supabase_sync.is_configured(),
        }

    def check_updates(self) -> dict:
        # Local free app: report current version; site is the release channel.
        return {
            "ok": True,
            "current": APP_VERSION,
            "latest": APP_VERSION,
            "upToDate": True,
            "message": f"ShiftVoice {APP_VERSION} is up to date. New builds appear on shiftzero.netlify.app.",
            "changelog": [
                "Silence page: remove silence from generated MP3s",
                "Dashboard Overview with price comparison",
                "Time-of-day greeting from system clock (morning / afternoon / evening / night)",
                "Compact podcast stats; advanced lines optional",
                "Jobs: Play · Library · Open folder",
                "Roadmap / Batch / Usage pages",
            ],
            "url": "https://shiftzero.netlify.app",
        }

    def list_voices(self, force: bool = False) -> dict:
        try:
            if self._voices_cache is None or force:
                voices = _run(edge_tts.list_voices())
                mapped = []
                for v in voices:
                    mapped.append(
                        {
                            "shortName": v.get("ShortName") or v.get("Name", ""),
                            "name": v.get("FriendlyName") or v.get("Name", ""),
                            "locale": v.get("Locale", ""),
                            "gender": v.get("Gender", ""),
                        }
                    )
                mapped.sort(key=lambda x: x["shortName"])
                self._voices_cache = mapped
            return {"ok": True, "voices": self._voices_cache}
        except Exception as e:
            fail = _public_fail("list_voices", e)
            fail["voices"] = list(self._voices_cache or [])
            return fail

    def get_settings(self) -> dict:
        return {
            "ok": True,
            "outputDir": self.output_dir,
            "version": APP_VERSION,
            "maintenanceMode": self.maintenance_mode,
        }

    def get_public_status(self) -> dict:
        unread = 0
        try:
            items = _load_json(ADMIN_ERRORS, [])
            unread = sum(1 for i in items if not i.get("read"))
        except Exception:
            unread = 0
        try:
            self._refresh_cloud_settings()
        except Exception:
            pass
        return {
            "ok": True,
            "maintenanceMode": self._is_maintenance(),
            "adminUnreadErrors": unread,
            "version": APP_VERSION,
            "supabaseConfigured": supabase_sync.is_configured(),
            "hwid": supabase_sync.device_hwid() if supabase_sync.is_configured() else "",
        }

    def admin_unlock(self, pin: str) -> dict:
        if str(pin or "").strip() != str(self.admin_pin):
            return {"ok": False, "message": "Wrong admin PIN"}
        return {"ok": True, "unlocked": True}

    def admin_set_pin(self, payload: dict | None = None) -> dict:
        if isinstance(payload, str):
            try:
                payload = json.loads(payload)
            except Exception:
                return {"ok": False, "message": "Invalid payload"}
        payload = payload or {}
        if str(payload.get("currentPin") or "") != str(self.admin_pin):
            return {"ok": False, "message": "Current PIN is wrong"}
        new_pin = str(payload.get("newPin") or "").strip()
        if len(new_pin) < 4:
            return {"ok": False, "message": "New PIN must be at least 4 characters"}
        self.admin_pin = new_pin
        self._persist_settings()
        return {"ok": True, "message": "Admin PIN updated"}

    def admin_set_maintenance(self, enabled: bool) -> dict:
        self.maintenance_mode = bool(enabled)
        self._persist_settings()
        return {"ok": True, "maintenanceMode": self.maintenance_mode}

    def admin_list_errors(self, pin: str = "") -> dict:
        if str(pin or "").strip() != str(self.admin_pin):
            return {"ok": False, "message": "Admin unlock required", "items": []}
        items = _load_json(ADMIN_ERRORS, [])
        return {"ok": True, "items": items if isinstance(items, list) else []}

    def admin_mark_errors_read(self, pin: str = "") -> dict:
        if str(pin or "").strip() != str(self.admin_pin):
            return {"ok": False, "message": "Admin unlock required"}
        items = _load_json(ADMIN_ERRORS, [])
        if isinstance(items, list):
            for row in items:
                row["read"] = True
            _save_json(ADMIN_ERRORS, items)
        return {"ok": True}

    def admin_clear_errors(self, pin: str = "") -> dict:
        if str(pin or "").strip() != str(self.admin_pin):
            return {"ok": False, "message": "Admin unlock required"}
        _save_json(ADMIN_ERRORS, [])
        return {"ok": True, "items": []}

    def admin_overview(self, pin: str = "") -> dict:
        if str(pin or "").strip() != str(self.admin_pin):
            return {"ok": False, "message": "Admin unlock required"}
        items = _load_json(ADMIN_ERRORS, []) if isinstance(_load_json(ADMIN_ERRORS, []), list) else []
        with self._job_lock:
            jobs = list(self._jobs)
        return {
            "ok": True,
            "version": APP_VERSION,
            "maintenanceMode": self.maintenance_mode,
            "charsGenerated": self.chars_generated,
            "exportsCount": self.exports_count,
            "batchesCount": self.batches_count,
            "jobsTotal": len(jobs),
            "jobsFailed": sum(1 for j in jobs if j.get("status") == "failed"),
            "voicesCached": len(self._voices_cache or []),
            "errorCount": len(items),
            "unreadErrors": sum(1 for i in items if not i.get("read")),
            "outputDir": self.output_dir,
        }

    def pick_audio_file(self) -> dict:
        result = webview.windows[0].create_file_dialog(
            webview.OPEN_DIALOG,
            allow_multiple=False,
            file_types=("Audio (*.mp3;*.wav;*.m4a;*.ogg)",),
        )
        if not result:
            return {"ok": False, "message": "No file selected"}
        path = Path(result[0] if isinstance(result, (list, tuple)) else result)
        return {"ok": True, "path": str(path), "name": path.name}

    def remove_silence(self, payload: dict | None = None) -> dict:
        if isinstance(payload, str):
            try:
                payload = json.loads(payload)
            except Exception:
                return {"ok": False, "message": "Invalid payload"}
        payload = payload or {}
        path_str = (payload.get("path") or "").strip()
        if not path_str:
            return {"ok": False, "message": "Choose an audio file first."}
        src = Path(path_str)
        if not src.exists():
            return {"ok": False, "message": "File not found."}
        keep_sec = float(payload.get("keepSilence") or 0.05)
        keep_ms = int(max(0.0, keep_sec) * 1000)
        started = time.time()
        try:
            out = _strip_silence_file(src, keep_ms=keep_ms)
            stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            export = Path(self.output_dir) / f"shiftvoice_nosilence_{stamp}{out.suffix}"
            export.write_bytes(out.read_bytes())
            item = {
                "id": uuid.uuid4().hex[:8],
                "text": f"Silence cleaned · {src.name}",
                "voice": "shiftvoice",
                "path": str(export),
                "url": export.as_uri(),
                "createdAt": _utc_now(),
                "kind": "silence",
            }
            hist = _load_json(HISTORY, [])
            hist.insert(0, item)
            _save_json(HISTORY, hist[:200])
            self._track_usage(
                "",
                kind="silence",
                job_id=item["id"],
                title=f"Silence · {src.name}",
                voice="silence",
                elapsed_ms=int(max(0.0, (time.time() - started) * 1000)),
                meta={"source": src.name, "bytes": export.stat().st_size},
                count_chars=False,
                count_export=True,
            )
            audio = _maybe_audio(export)
            return {
                "ok": True,
                "path": str(export),
                "audio": audio,
                "large": audio is None,
                "message": f"Saved cleaned audio → {export}",
            }
        except Exception as e:
            return _public_fail("remove_silence", e, "Could not remove silence from that file.")

    def _reload_library(self) -> None:
        lib = _load_json(LIBRARY, {"favorites": [], "pairs": []})
        self.favorites = list(lib.get("favorites") or [])
        self.pairs = list(lib.get("pairs") or [])

    def get_library(self) -> dict:
        self._reload_library()
        return {"ok": True, "favorites": self.favorites, "pairs": self.pairs}

    def toggle_favorite(self, voice_id: str) -> dict:
        self._reload_library()
        voice_id = (voice_id or "").strip()
        if not voice_id:
            return {"ok": False, "message": "Missing voice"}
        if voice_id in self.favorites:
            self.favorites = [v for v in self.favorites if v != voice_id]
            saved = False
        else:
            self.favorites = [voice_id, *[v for v in self.favorites if v != voice_id]]
            saved = True
        self._persist_library()
        return {"ok": True, "saved": saved, "favorites": self.favorites}

    def save_podcast_pair(self, payload) -> dict:
        self._reload_library()
        if isinstance(payload, str):
            try:
                payload = json.loads(payload)
            except Exception:
                return {"ok": False, "message": "Invalid pair data"}
        payload = payload or {}
        mode = (payload.get("mode") or "create").strip().lower()
        pair_id = (payload.get("id") or "").strip()
        name = (payload.get("name") or "").strip()
        host = (payload.get("host") or "").strip()
        guest = (payload.get("guest") or "").strip()
        if not name or not host or not guest:
            return {"ok": False, "message": "Name, host voice, and guest voice are required."}
        if host == guest:
            return {"ok": False, "message": "Pick two different voices."}

        if mode == "update":
            if not pair_id:
                return {"ok": False, "message": "Select a pair to update."}
            updated = None
            new_pairs = []
            for p in self.pairs:
                if p.get("id") != pair_id:
                    # block duplicate names on other pairs
                    if (p.get("name") or "").strip().lower() == name.lower():
                        return {"ok": False, "message": "Another pair already uses this name."}
                    new_pairs.append(p)
                    continue
                updated = {
                    **p,
                    "name": name,
                    "host": host,
                    "guest": guest,
                }
                new_pairs.append(updated)
            if not updated:
                return {"ok": False, "message": "Pair not found."}
            self.pairs = new_pairs
            self._persist_library()
            return {"ok": True, "mode": "update", "pair": updated, "pairs": self.pairs}

        # create — always add a new pair (many pairs allowed)
        if any((p.get("name") or "").strip().lower() == name.lower() for p in self.pairs):
            return {
                "ok": False,
                "message": "This name already exists. Choose Update old pair, or pick a new name.",
            }
        pair = {
            "id": uuid.uuid4().hex[:8],
            "name": name,
            "host": host,
            "guest": guest,
            "createdAt": _utc_now(),
        }
        self.pairs = [pair, *self.pairs]
        self._persist_library()
        return {"ok": True, "mode": "create", "pair": pair, "pairs": self.pairs}

    def delete_podcast_pair(self, pair_id: str) -> dict:
        self._reload_library()
        self.pairs = [p for p in self.pairs if p.get("id") != pair_id]
        self._persist_library()
        return {"ok": True, "pairs": self.pairs}

    def update_podcast_pair(self, payload) -> dict:
        if isinstance(payload, str):
            try:
                payload = json.loads(payload)
            except Exception:
                return {"ok": False, "message": "Invalid pair data"}
        payload = dict(payload or {})
        payload["mode"] = "update"
        return self.save_podcast_pair(payload)

    def choose_output_folder(self) -> dict:
        result = webview.windows[0].create_file_dialog(webview.FOLDER_DIALOG)
        if result and len(result) > 0:
            self.output_dir = result[0]
            Path(self.output_dir).mkdir(parents=True, exist_ok=True)
            self._persist_settings()
            return {"ok": True, "path": self.output_dir}
        return {"ok": False, "path": self.output_dir}

    def create_output_folder(self) -> dict:
        Path(self.output_dir).mkdir(parents=True, exist_ok=True)
        self._persist_settings()
        return {"ok": True, "path": self.output_dir}

    def list_history(self) -> dict:
        items = _load_json(HISTORY, [])
        enriched = []
        for item in items:
            row = dict(item)
            path = Path(row.get("path") or "")
            if path.exists():
                audio = _maybe_audio(path)
                if audio:
                    row["audio"] = audio
                else:
                    row["large"] = True
            enriched.append(row)
        return {"ok": True, "items": enriched}

    def clear_history(self) -> dict:
        _save_json(HISTORY, [])
        return {"ok": True, "items": []}

    def open_output_folder(self) -> dict:
        try:
            Path(self.output_dir).mkdir(parents=True, exist_ok=True)
            if sys.platform == "win32":
                os.startfile(self.output_dir)  # noqa: S606
            else:
                webbrowser.open(self.output_dir)
            return {"ok": True}
        except Exception as e:
            return {"ok": False, "message": str(e)}

    def open_path(self, path: str) -> dict:
        """Open a file's parent folder (or the folder itself). Falls back to output dir."""
        try:
            target = Path(path) if path else Path(self.output_dir)
            if target.is_file():
                target = target.parent
            if not target.exists():
                target = Path(self.output_dir)
            target.mkdir(parents=True, exist_ok=True)
            if sys.platform == "win32":
                os.startfile(str(target))  # noqa: S606
            else:
                webbrowser.open(str(target))
            return {"ok": True, "path": str(target)}
        except Exception as e:
            return {"ok": False, "message": str(e)}

    def open_external_url(self, url: str) -> dict:
        webbrowser.open(url)
        return {"ok": True}

    def preview_voice(
        self,
        voice: str,
        rate: str = "+0%",
        pitch: str = "+0Hz",
        volume: str = "+0%",
    ) -> dict:
        text = "Hello. Welcome to ShiftVoice by ShiftZero."
        out = PREVIEWS / f"{uuid.uuid4().hex}.mp3"
        try:
            _run(self._synthesize(text, voice, rate, pitch, volume, out))
            audio = _b64_audio(out)
            return {"ok": True, "path": str(out), "audio": audio, "url": audio}
        except Exception as e:
            return _public_fail("preview_voice", e, "Preview failed. Try again in a moment.")

    def generate_audio(self, payload: dict) -> dict:
        if self._is_maintenance():
            return {
                "ok": False,
                "message": self._maintenance_message(),
                "maintenance": True,
            }
        if isinstance(payload, str):
            try:
                payload = json.loads(payload)
            except Exception:
                return {"ok": False, "message": "Invalid payload"}
        text = (payload or {}).get("text", "").strip()
        voice = (payload or {}).get("voice", "")
        rate = (payload or {}).get("rate", "+0%")
        pitch = (payload or {}).get("pitch", "+0Hz")
        volume = (payload or {}).get("volume", "+0%")
        if not text:
            return {"ok": False, "message": "Enter some text first."}
        if not voice:
            return {"ok": False, "message": "Choose a voice."}

        words = len(text.split())
        est_min = round(words / 150.0, 1)
        job_id = uuid.uuid4().hex[:8]
        job = {
            "id": job_id,
            "kind": "studio",
            "title": (text[:48] + "…") if len(text) > 48 else text,
            "status": "queued",
            "progress": 0,
            "label": "Queued",
            "etaMin": est_min,
            "chars": len(text),
            "lines": 1,
            "createdAt": _utc_now(),
            "updatedAt": _utc_now(),
            "payload": {
                "text": text,
                "voice": voice,
                "rate": rate,
                "pitch": pitch,
                "volume": volume,
            },
        }
        self._upsert_job(job)
        threading.Thread(target=self._run_studio_job, args=(job_id,), daemon=True).start()
        return {"ok": True, "queued": True, "job": job}

    def generate_podcast(self, payload: dict) -> dict:
        if self._is_maintenance():
            return {
                "ok": False,
                "message": self._maintenance_message(),
                "maintenance": True,
            }
        if isinstance(payload, str):
            try:
                payload = json.loads(payload)
            except Exception:
                return {"ok": False, "message": "Invalid payload"}
        lines = (payload or {}).get("lines") or []
        rate = (payload or {}).get("rate", "+0%")
        pitch = (payload or {}).get("pitch", "+0Hz")
        volume = (payload or {}).get("volume", "+0%")
        valid_lines = []
        total_chars = 0
        for line in lines:
            text = (line.get("text") or "").strip()
            voice = line.get("voice") or ""
            if text and voice:
                valid_lines.append(
                    {"text": text, "voice": voice, "speaker": line.get("speaker") or ""}
                )
                total_chars += len(text)
        if not valid_lines:
            return {"ok": False, "message": "No valid lines to generate."}

        words = sum(len(l["text"].split()) for l in valid_lines)
        speakers = len({(l.get("speaker") or "").lower() for l in valid_lines})
        est_min = round(words / 150.0, 1)
        job_id = uuid.uuid4().hex[:8]
        job = {
            "id": job_id,
            "kind": "podcast",
            "title": f"Podcast · {len(valid_lines)} lines · {speakers} characters",
            "status": "queued",
            "progress": 0,
            "label": "Queued",
            "etaMin": est_min,
            "chars": total_chars,
            "lines": len(valid_lines),
            "speakers": speakers,
            "createdAt": _utc_now(),
            "updatedAt": _utc_now(),
            "payload": {
                "lines": valid_lines,
                "rate": rate,
                "pitch": pitch,
                "volume": volume,
            },
        }
        self._upsert_job(job)
        threading.Thread(target=self._run_podcast_job, args=(job_id,), daemon=True).start()
        return {"ok": True, "queued": True, "job": job}

    def _find_job(self, job_id: str) -> dict | None:
        with self._job_lock:
            for job in self._jobs:
                if job.get("id") == job_id:
                    return dict(job)
        return None

    def _run_studio_job(self, job_id: str) -> None:
        job = self._find_job(job_id)
        if not job:
            return
        payload = job.get("payload") or {}
        text = payload.get("text") or ""
        voice = payload.get("voice") or ""
        rate = payload.get("rate", "+0%")
        pitch = payload.get("pitch", "+0Hz")
        volume = payload.get("volume", "+0%")
        job_dir = JOBS / f"job_{job_id}"
        job_dir.mkdir(parents=True, exist_ok=True)
        out = job_dir / "output.mp3"
        started = time.time()
        try:
            job.update(
                {
                    "status": "running",
                    "progress": 0.02,
                    "label": "Fast parallel synthesize…",
                    "updatedAt": _utc_now(),
                    "startedAt": _utc_now(),
                }
            )
            self._upsert_job(job)

            def prog(p):
                cur = self._find_job(job_id) or job
                cur.update(
                    {
                        "status": "running",
                        "progress": 0.05 + p * 0.9,
                        "label": f"Rendering… {int(p * 100)}%",
                        "updatedAt": _utc_now(),
                        "elapsedSec": round(time.time() - started, 1),
                    }
                )
                self._upsert_job(cur)

            _run(
                _synthesize_fast(
                    text, voice, rate, pitch, volume, out, concurrency=14, on_progress=prog
                )
            )
            stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            export = Path(self.output_dir) / f"shiftvoice_{stamp}_{job_id}.mp3"
            export.write_bytes(out.read_bytes())
            elapsed_ms = int(max(0.0, (time.time() - started) * 1000))
            self._track_usage(
                text,
                kind="studio",
                job_id=job_id,
                title=job.get("title") or "",
                voice=voice,
                elapsed_ms=elapsed_ms,
            )
            item = {
                "id": job_id,
                "title": (job.get("title") or text)[:80],
                "text": text[:160],
                "voice": voice,
                "path": str(export),
                "url": export.as_uri(),
                "createdAt": _utc_now(),
                "chars": len(text),
            }
            hist = _load_json(HISTORY, [])
            hist.insert(0, item)
            _save_json(HISTORY, hist[:200])
            done = self._find_job(job_id) or job
            done.update(
                {
                    "status": "done",
                    "progress": 1,
                    "label": "Saved",
                    "path": str(export),
                    "updatedAt": _utc_now(),
                    "elapsedSec": round(time.time() - started, 1),
                    "audio": _maybe_audio(export),
                    "large": _maybe_audio(export) is None,
                }
            )
            self._upsert_job(done)
        except Exception as e:
            safe = _safe_user_message(e, "Generation failed. Please try again.")
            _append_admin_error("studio_job", e, safe)
            failed = self._find_job(job_id) or job
            failed.update(
                {
                    "status": "failed",
                    "progress": 0,
                    "label": "Failed",
                    "error": safe,
                    "updatedAt": _utc_now(),
                }
            )
            self._upsert_job(failed)
            try:
                supabase_sync.bump_tts(
                    chars=0,
                    exports=0,
                    success=False,
                    display_name=platform.node() or "ShiftVoice",
                    kind="studio",
                    meta={"job_id": job_id, "voice": voice},
                )
            except Exception:
                pass

    def _run_podcast_job(self, job_id: str) -> None:
        job = self._find_job(job_id)
        if not job:
            return
        payload = job.get("payload") or {}
        valid_lines = payload.get("lines") or []
        rate = payload.get("rate", "+0%")
        pitch = payload.get("pitch", "+0Hz")
        volume = payload.get("volume", "+0%")
        job_dir = JOBS / f"job_{job_id}"
        chunks = job_dir / "chunks"
        chunks.mkdir(parents=True, exist_ok=True)
        total = len(valid_lines)
        total_chars = sum(len(l.get("text") or "") for l in valid_lines)
        started = time.time()
        try:
            job.update(
                {
                    "status": "running",
                    "progress": 0.01,
                    "label": "Preparing cast…",
                    "updatedAt": _utc_now(),
                    "startedAt": _utc_now(),
                }
            )
            self._upsert_job(job)

            async def run_podcast():
                line_sem = asyncio.Semaphore(4)
                done = {"n": 0}

                async def one(i: int, line: dict) -> Path:
                    part = chunks / f"chunk_{i}.mp3"
                    speaker = line.get("speaker") or f"Line {i + 1}"
                    async with line_sem:
                        cur = self._find_job(job_id) or job
                        cur.update(
                            {
                                "status": "running",
                                "progress": (done["n"] + 0.2) / max(total, 1),
                                "label": f"{speaker} · {done['n'] + 1}/{total}",
                                "updatedAt": _utc_now(),
                                "elapsedSec": round(time.time() - started, 1),
                            }
                        )
                        self._upsert_job(cur)
                        await _synthesize_fast(
                            line["text"],
                            line["voice"],
                            rate,
                            pitch,
                            volume,
                            part,
                            concurrency=10,
                        )
                        done["n"] += 1
                        cur = self._find_job(job_id) or job
                        cur.update(
                            {
                                "status": "running",
                                "progress": done["n"] / max(total, 1),
                                "label": f"{speaker} · {done['n']}/{total}",
                                "updatedAt": _utc_now(),
                                "elapsedSec": round(time.time() - started, 1),
                            }
                        )
                        self._upsert_job(cur)
                    return part

                return await asyncio.gather(
                    *[one(i, line) for i, line in enumerate(valid_lines)]
                )

            parts = list(_run(run_podcast()))
            out = job_dir / "output.mp3"
            with open(out, "wb") as dest:
                for p in parts:
                    dest.write(p.read_bytes())
            stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            export = Path(self.output_dir) / f"shiftvoice_podcast_{stamp}_{job_id}.mp3"
            export.write_bytes(out.read_bytes())
            voice_list = [
                (l.get("voice") or "")
                for l in valid_lines
                if (l.get("voice") or "").strip()
            ]
            uniq_voices = list(dict.fromkeys(voice_list))
            elapsed_ms = int(max(0.0, (time.time() - started) * 1000))
            self._track_usage(
                "x" * total_chars,
                kind="podcast",
                job_id=job_id,
                title=job.get("title") or "",
                voice=uniq_voices[0] if uniq_voices else "multi",
                voices=uniq_voices,
                elapsed_ms=elapsed_ms,
            )
            item = {
                "id": job_id,
                "title": (job.get("title") or f"Podcast · {len(valid_lines)} lines")[:80],
                "text": f"Podcast · {len(valid_lines)} lines",
                "voice": "multi",
                "path": str(export),
                "url": export.as_uri(),
                "createdAt": _utc_now(),
                "kind": "podcast",
                "chars": total_chars,
            }
            hist = _load_json(HISTORY, [])
            hist.insert(0, item)
            _save_json(HISTORY, hist[:200])
            done_job = self._find_job(job_id) or job
            done_job.update(
                {
                    "status": "done",
                    "progress": 1,
                    "label": "Podcast saved",
                    "path": str(export),
                    "updatedAt": _utc_now(),
                    "elapsedSec": round(time.time() - started, 1),
                    "audio": _maybe_audio(export),
                    "large": _maybe_audio(export) is None,
                }
            )
            self._upsert_job(done_job)
        except Exception as e:
            safe = _safe_user_message(e, "Podcast generation failed. Please try again.")
            _append_admin_error("podcast_job", e, safe)
            failed = self._find_job(job_id) or job
            failed.update(
                {
                    "status": "failed",
                    "progress": 0,
                    "label": "Failed",
                    "error": safe,
                    "updatedAt": _utc_now(),
                }
            )
            self._upsert_job(failed)
            try:
                supabase_sync.bump_tts(
                    chars=0,
                    exports=0,
                    success=False,
                    display_name=platform.node() or "ShiftVoice",
                    kind="podcast",
                    meta={"job_id": job_id},
                )
            except Exception:
                pass

    async def _synthesize(
        self,
        text: str,
        voice: str,
        rate: str,
        pitch: str,
        volume: str,
        out: Path,
    ) -> None:
        await _synthesize_fast(text, voice, rate, pitch, volume, out, concurrency=8)


def main() -> None:
    api = Api()
    icon = str(ICON_ICO if ICON_ICO.exists() else ICON_PNG)
    window_kwargs = {
        "title": "ShiftVoice — ShiftZero",
        "url": str(WWW / "index.html"),
        "js_api": api,
        "width": 1360,
        "height": 880,
        "min_size": (900, 620),
        "background_color": "#f4f6f7",
    }
    # pywebview accepts icon= on most backends (Windows taskbar / window).
    try:
        webview.create_window(**window_kwargs, icon=icon)
    except TypeError:
        webview.create_window(**window_kwargs)
    webview.start(debug=False)


if __name__ == "__main__":
    main()
