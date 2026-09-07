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

for (const t of [
  'sv_devices',
  'sv_usage_events',
  'sv_error_logs',
  'sv_app_settings',
  'sv_notifications',
  'shiftvoice_usage',
  'shiftvoice_batches',
  'shiftvoice_jobs',
  'og_devices',
  'devices',
]) {
  const { error, count } = await sb.from(t).select('*', { count: 'exact', head: true })
  console.log(t, error ? `ERR ${error.message}` : `OK count=${count}`)
}
