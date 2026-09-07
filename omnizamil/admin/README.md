# Omni-Removal Admin (Supabase)

## One-time database setup

1. Open [SQL Editor](https://supabase.com/dashboard/project/udwjdqzlkhtklsvedblg/sql/new)
2. Paste and **Run** everything in `../supabase/schema.sql`
3. Also run `../supabase/schema-delta.sql` (country columns + **100k scale pack**: indexes, `bump_device_clean`, `admin_device_metrics`)
4. Confirm tables exist: `devices`, `usage_events`, `error_logs`, `app_settings`

## Scale notes (100k devices)

- Desktop: register once + slim heartbeat every 90s (no event spam)
- Admin: metrics via SQL RPC; device list capped at 500 recent; poll every 45s
- Re-run `schema-delta.sql` whenever you pull updates that add RPCs/indexes

## Run admin (you only)

```bash
cd admin
npm install
npm run dev
```

Open http://localhost:5174  
Password: value of `VITE_ADMIN_PASSWORD` in `admin/.env` (default `omni-admin`)

## How it connects

| App | Key | What it does |
| --- | --- | --- |
| Desktop Omni-Removal | publishable / anon | Registers device + username, heartbeats, usage, errors |
| Admin panel | service role (local `.env` only) | Reads all devices, analytics, errors, maintenance |

**Never** put the service role key in the desktop app or a public website.

## After schema is applied

1. Start desktop (`npm start` in `omnizamil/`)
2. Enter your name on first launch → device appears in admin **Devices**
3. Clean an image/video → counts update in admin
4. Engine failures → friendly message for user; full detail in admin **Errors**
