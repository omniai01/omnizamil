import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function load(p) {
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (!m) continue
    let v = m[2].trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    process.env[m[1].trim()] = v
  }
}

load('d:/omni watermakr remover/omnizamil/admin/.env')
const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
const sb = createClient(url, key, { auth: { persistSession: false } })

const hwid = 'sv-smoke-test-device'
const { error: upErr } = await sb.from('sv_devices').upsert(
  {
    hwid,
    display_name: 'ShiftVoice Smoke',
    user_alias: 'ShiftVoice Smoke',
    os: 'Windows',
    app_version: '1.6.0',
    country: 'Pakistan',
    country_code: 'PK',
    status: 'active',
    last_ping: new Date().toISOString(),
  },
  { onConflict: 'hwid' },
)
console.log('upsert', upErr ? upErr.message : 'OK')

const { error: rpcErr } = await sb.rpc('sv_bump_tts', {
  p_hwid: hwid,
  p_chars: 42,
  p_exports: 1,
  p_success: true,
  p_elapsed_ms: 100,
  p_display_name: 'ShiftVoice Smoke',
  p_kind: 'studio',
  p_meta: { smoke: true },
})
console.log('sv_bump_tts', rpcErr ? rpcErr.message : 'OK')

const { data: metrics, error: mErr } = await sb.rpc('sv_admin_device_metrics', {
  online_minutes: 10,
})
console.log('metrics', mErr ? mErr.message : JSON.stringify(metrics))

const { data: row, error: rErr } = await sb
  .from('sv_devices')
  .select('hwid,image_count,video_count')
  .eq('hwid', hwid)
  .maybeSingle()
console.log('device', rErr ? rErr.message : JSON.stringify(row))
