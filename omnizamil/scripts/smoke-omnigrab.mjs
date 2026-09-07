/**
 * Smoke-test OmniGrab tables: register a fake device, bump counts, read settings.
 * Uses admin/.env service role. Does not build EXE.
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
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!process.env[k]) process.env[k] = v
  }
}
loadEnv(resolve(root, 'admin/.env'))

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
const sb = createClient(url, key, { auth: { persistSession: false } })
const hwid = 'og-test-0000-0000-0000-smoke'

const { error: upErr } = await sb.from('og_devices').upsert({
  hwid,
  display_name: 'Smoke Tester',
  user_alias: 'Smoke Tester',
  os: 'Windows',
  status: 'active',
  last_ping: new Date().toISOString(),
  country: 'Pakistan',
  country_code: 'PK',
  app_version: '1.1.0',
}, { onConflict: 'hwid' })
if (upErr) {
  console.error('upsert device', upErr.message)
  process.exit(1)
}
console.log('device upsert OK')

const { error: evErr } = await sb.from('og_usage_events').insert({
  hwid,
  event_type: 'download',
  media_type: 'video',
  success: true,
  elapsed_ms: 1200,
  meta: { platform: 'youtube', smoke: true },
})
if (evErr) {
  console.error('event insert', evErr.message)
  process.exit(1)
}
console.log('usage event OK')

await sb.from('og_devices').update({
  image_count: 1,
  video_count: 1,
  last_ping: new Date().toISOString(),
}).eq('hwid', hwid)

const { data: settings, error: sErr } = await sb.from('og_app_settings').select('id, maintenance_enabled, force_update, update_url').eq('id', 1).maybeSingle()
if (sErr) {
  console.error('settings', sErr.message)
  process.exit(1)
}
console.log('settings OK', settings)

const { data: devices } = await sb.from('og_devices').select('hwid, display_name, image_count, video_count').eq('hwid', hwid)
console.log('device row', devices)

// cleanup smoke
await sb.from('og_usage_events').delete().eq('hwid', hwid)
await sb.from('og_devices').delete().eq('hwid', hwid)
console.log('smoke cleaned — OmniGrab DB path works')
