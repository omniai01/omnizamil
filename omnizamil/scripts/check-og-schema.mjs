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
const res = await fetch(`${url}/rest/v1/`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
})
const text = await res.text()
console.log('openapi status', res.status)
console.log('og_devices in openapi', /og_devices/.test(text))
console.log(
  'og_ tables mentioned',
  [...new Set(text.match(/og_[a-z_]+/g) || [])].slice(0, 20),
)

const sb = createClient(url, key, { auth: { persistSession: false } })
for (const t of [
  'og_devices',
  'devices',
  'og_app_settings',
  'app_settings',
]) {
  const { error, count } = await sb.from(t).select('*', { count: 'exact', head: true })
  console.log(t, error ? `ERR ${error.message}` : `OK count=${count}`)
}
