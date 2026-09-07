"""
ShiftVoice speed bench (no UI).
1) One ~5 hour track (single voice)
2) Batch: 10 voices × ~20 min each
"""
from __future__ import annotations

import asyncio
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from app import _synthesize_fast  # noqa: E402

OUT = ROOT / "work" / "bench_runs"
OUT.mkdir(parents=True, exist_ok=True)
LOG = OUT / "bench_log.jsonl"

# ~150 spoken words/min (app ETA uses the same)
WPM = 150
SEED = (
    "ShiftVoice speed test. Clear spoken English for timing only. "
    "Keep a steady pace across chunks and voices. "
)

VOICES_20M = [
    "en-US-JennyNeural",
    "en-US-GuyNeural",
    "en-GB-SoniaNeural",
    "en-GB-RyanNeural",
    "en-AU-NatashaNeural",
    "en-AU-WilliamNeural",
    "en-CA-ClaraNeural",
    "en-CA-LiamNeural",
    "en-IN-NeerjaNeural",
    "en-IN-PrabhatNeural",
]


def words_for_minutes(minutes: float) -> int:
    return max(50, int(minutes * WPM))


def make_text(minutes: float) -> str:
    need = words_for_minutes(minutes)
    seed_words = SEED.split()
    out: list[str] = []
    while len(out) < need:
        out.extend(seed_words)
    return " ".join(out[:need])


def log(event: dict) -> None:
    event = {"ts": datetime.now(timezone.utc).isoformat(), **event}
    print(json.dumps(event), flush=True)
    with LOG.open("a", encoding="utf-8") as f:
        f.write(json.dumps(event) + "\n")


async def timed_synth(name: str, text: str, voice: str, out: Path, concurrency: int = 14) -> dict:
    out.parent.mkdir(parents=True, exist_ok=True)
    started = time.perf_counter()
    last_p = {"p": 0.0}

    def prog(p: float) -> None:
        if p - last_p["p"] >= 0.05 or p >= 0.999:
            last_p["p"] = p
            log({"event": "progress", "name": name, "pct": round(p * 100, 1)})

    try:
        await _synthesize_fast(
            text, voice, "+0%", "+0Hz", "+0%", out, concurrency=concurrency, on_progress=prog
        )
        ok = True
        err = ""
    except Exception as e:
        ok = False
        err = str(e)[:500]

    elapsed = time.perf_counter() - started
    size = out.stat().st_size if out.exists() else 0
    result = {
        "event": "done",
        "name": name,
        "ok": ok,
        "error": err,
        "voice": voice,
        "chars": len(text),
        "words": len(text.split()),
        "targetMin": round(len(text.split()) / WPM, 2),
        "wallSec": round(elapsed, 1),
        "wallMin": round(elapsed / 60, 2),
        "bytes": size,
        "mb": round(size / (1024 * 1024), 2),
        "path": str(out),
    }
    log(result)
    return result


async def main() -> None:
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log({"event": "start", "stamp": stamp})

    # --- 1) ~5 hour single voice ---
    text_5h = make_text(300)  # 5 hours
    out_5h = OUT / f"bench_5h_{stamp}.mp3"
    log(
        {
            "event": "phase",
            "phase": "5h_single",
            "words": len(text_5h.split()),
            "chars": len(text_5h),
            "voice": VOICES_20M[0],
        }
    )
    r5 = await timed_synth("5h_single", text_5h, VOICES_20M[0], out_5h, concurrency=14)

    # --- 2) 10 × 20 min batch (sequential jobs, parallel chunks inside each) ---
    text_20 = make_text(20)
    batch_results = []
    batch_start = time.perf_counter()
    log(
        {
            "event": "phase",
            "phase": "batch_10x20m",
            "jobs": 10,
            "wordsEach": len(text_20.split()),
            "charsEach": len(text_20),
        }
    )
    for i, voice in enumerate(VOICES_20M, 1):
        out = OUT / f"bench_20m_{i:02d}_{voice}_{stamp}.mp3"
        log({"event": "batch_job_start", "i": i, "voice": voice})
        r = await timed_synth(f"batch_20m_{i:02d}", text_20, voice, out, concurrency=14)
        batch_results.append(r)

    batch_wall = time.perf_counter() - batch_start
    ok_n = sum(1 for r in batch_results if r.get("ok"))
    summary = {
        "event": "summary",
        "fiveHour": {
            "ok": r5.get("ok"),
            "wallMin": r5.get("wallMin"),
            "targetMin": r5.get("targetMin"),
            "mb": r5.get("mb"),
            "path": r5.get("path"),
            "error": r5.get("error") or None,
        },
        "batch10x20": {
            "okCount": ok_n,
            "totalJobs": len(batch_results),
            "wallMin": round(batch_wall / 60, 2),
            "perJobMinAvg": round(
                (sum(r["wallSec"] for r in batch_results) / max(1, len(batch_results))) / 60, 2
            ),
            "jobs": [
                {
                    "name": r["name"],
                    "voice": r["voice"],
                    "ok": r["ok"],
                    "wallMin": r["wallMin"],
                    "mb": r["mb"],
                }
                for r in batch_results
            ],
        },
    }
    log(summary)
    (OUT / f"bench_summary_{stamp}.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print("\n=== SUMMARY ===", flush=True)
    print(json.dumps(summary, indent=2), flush=True)


if __name__ == "__main__":
    asyncio.run(main())
