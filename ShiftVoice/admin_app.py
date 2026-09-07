"""ShiftVoice Admin — separate operator window (not shown in user app)."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import webview

from app import Api, ICON_ICO, ICON_PNG  # noqa: E402

ADMIN_HTML = Path(__file__).resolve().parent / "index.html"


def main() -> None:
    api = Api()
    icon = str(ICON_ICO if ICON_ICO.exists() else ICON_PNG)
    kwargs = {
        "title": "ShiftVoice Admin — ShiftZero",
        "url": str(ADMIN_HTML),
        "js_api": api,
        "width": 1180,
        "height": 780,
        "min_size": (900, 600),
        "background_color": "#f4f7f7",
    }
    try:
        webview.create_window(**kwargs, icon=icon)
    except TypeError:
        webview.create_window(**kwargs)
    webview.start(debug=False)


if __name__ == "__main__":
    main()
