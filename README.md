# Omnizamil (private backup)

Private source backup for **ShiftZero / OmniGrab** products.

## What’s in this repo

| Path | Contents |
|------|----------|
| `omnizamil/` | Admin panel, website, Supabase schemas / scripts |
| `ShiftGrab/` | ShiftGrab desktop app source (Electron) |

Public download hubs stay separate (`omniai01/shiftgrab` releases, website hosting). This repo is **source backup only**.

## Secrets

- Never commit `.env` / service keys. Use `.env.example` only.
- Do not commit `node_modules`, `dist`, `out`, or `release/*.exe`.

## Backup habit

After a feature batch is finished and tested, say **“backup push”** (or push from this clone) so `main` stays the latest working source.
