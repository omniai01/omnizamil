/**
 * Apply OmniGrab schema via Supabase SQL using the Management API is not available
 * with anon/service keys alone. This script verifies og_* tables exist.
 *
 * Run schema manually once:
 *   Supabase Dashboard → SQL Editor → paste omnizamil/supabase/schema-omnigrab.sql → Run
 *
 * Then: node scripts/verify-omnigrab.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
function loadEnv(file) {
  if (!existsSync(file)) return
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (!m) continue
    const k = m[1].trim()
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (!process.env[k]) process.env[k] = v
  }
}

loadEnv(resolve(root, '.env'))
loadEnv(resolve(root, '../admin/.env'))

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL / key')
  process.exit(1)
}

const sb = createClient(url, key, { auth: { persistSession: false } })
const tables = ['og_devices', 'og_usage_events', 'og_error_logs', 'og_app_settings', 'og_notifications']
let ok = true
for (const t of tables) {
  const col = t.includes('settings') ? 'id' : t.includes('notifications') || t.includes('error') || t.includes('usage') ? 'id' : 'hwid'
  const { error } = await sb.from(t).select(col).limit(1)
  if (error) {
    ok = false
    console.error(`FAIL ${t}: ${error.message}`)
  } else {
    console.log(`OK   ${t}`)
  }
}
const { error: rpcErr } = await sb.rpc('og_admin_device_metrics', { online_minutes: 10 })
if (rpcErr) {
  ok = false
  console.error(`FAIL og_admin_device_metrics: ${rpcErr.message}`)
} else {
  console.log('OK   og_admin_device_metrics')
}

if (!ok) {
  console.error('\nApply omnizamil/supabase/schema-omnigrab.sql in Supabase SQL Editor, then re-run.')
  process.exit(2)
}
console.log('\nOmniGrab schema looks ready.')
