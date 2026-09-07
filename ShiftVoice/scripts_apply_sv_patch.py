"""Apply ShiftVoice admin SQL patch via Supabase Management API or print instructions.
Requires SUPABASE_ACCESS_TOKEN (personal) or DATABASE_URL / SUPABASE_DB_PASSWORD.
Service role alone cannot run DDL via REST.
"""
from __future__ import annotations

import json
import os
import ssl
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PATCH = ROOT / "schema-shiftvoice-admin-patch.sql"
REF = "udwjdqzlkhtklsvedblg"


def load_dotenv(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.exists():
        return out
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def main() -> None:
    sql = PATCH.read_text(encoding="utf-8")
    env = {}
    env.update(load_dotenv(ROOT / ".env"))
    admin_env = Path(r"D:\omni watermakr remover\omnizamil\admin\.env")
    env.update(load_dotenv(admin_env))
    for k in ("SUPABASE_ACCESS_TOKEN", "DATABASE_URL", "SUPABASE_DB_PASSWORD", "POSTGRES_URL"):
        if os.environ.get(k):
            env[k] = os.environ[k]

    token = env.get("SUPABASE_ACCESS_TOKEN") or ""
    db_url = env.get("DATABASE_URL") or env.get("POSTGRES_URL") or ""
    db_pass = env.get("SUPABASE_DB_PASSWORD") or ""

    if token:
        endpoint = f"https://api.supabase.com/v1/projects/{REF}/database/query"
        data = json.dumps({"query": sql}).encode("utf-8")
        req = urllib.request.Request(
            endpoint,
            data=data,
            method="POST",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=60, context=ssl.create_default_context()) as resp:
                print("Management API OK", resp.status, resp.read()[:300])
                return
        except urllib.error.HTTPError as e:
            print("Management API failed", e.code, e.read()[:400])

    if db_url or db_pass:
        try:
            import psycopg2  # type: ignore
        except ImportError:
            print("psycopg2 not installed; cannot use DATABASE_URL")
        else:
            if not db_url and db_pass:
                db_url = (
                    f"postgresql://postgres.{REF}:{db_pass}"
                    f"@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"
                )
            conn = psycopg2.connect(db_url)
            conn.autocommit = True
            with conn.cursor() as cur:
                cur.execute(sql)
            conn.close()
            print("Applied via psycopg2")
            return

    print("NO_DB_CREDS")
    print("Run this file in Supabase SQL Editor:")
    print(str(PATCH))


if __name__ == "__main__":
    main()
