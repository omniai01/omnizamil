import { readFileSync } from 'node:fs'

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
const hwid = 'og-test-0000-0000-0000-smoke'

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
}

const get = await fetch(`${url}/rest/v1/og_devices?select=hwid&limit=1`, { headers })
console.log('GET', get.status, await get.text())

const post = await fetch(`${url}/rest/v1/og_devices`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    hwid,
    display_name: 'Smoke Tester',
    user_alias: 'Smoke Tester',
    status: 'active',
  }),
})
console.log('POST', post.status, await post.text())

const del = await fetch(`${url}/rest/v1/og_devices?hwid=eq.${hwid}`, {
  method: 'DELETE',
  headers,
})
console.log('DELETE', del.status, await del.text())
