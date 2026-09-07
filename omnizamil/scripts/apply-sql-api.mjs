import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const projectRef = 'udwjdqzlkhtklsvedblg'
const token = process.env.SUPABASE_ACCESS_TOKEN
if (!token) {
  console.error('Missing SUPABASE_ACCESS_TOKEN')
  process.exit(1)
}

const sqlPath = resolve(
  'd:/omni watermakr remover/omnizamil/supabase',
  process.argv[2] || 'schema-omnigrab.sql',
)
const query = readFileSync(sqlPath, 'utf8')

const res = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  },
)

const text = await res.text()
console.log('STATUS', res.status)
console.log(text.slice(0, 1500))
if (!res.ok) process.exit(1)
