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
console.log('has exec_sql', /exec_sql|run_sql|execute_sql/i.test(text))
console.log('sv_ in openapi', /sv_devices/.test(text))
console.log('paths sample', [...new Set(text.match(/\/[a-z0-9_]+/gi) || [])].filter((p) => /sv_|shiftvoice|og_/.test(p)).slice(0, 40))
