/**
 * Applies schema-delta.sql using service role via PostgREST is not possible for DDL.
 * This script upserts a smoke device so admin shows data after tables exist.
 * Load env from admin/.env manually — run: node --env-file=admin/.env scripts/smoke-register.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { hostname } from 'node:os';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Set VITE_SUPABASE_URL and service/anon key (use --env-file=admin/.env)');
  process.exit(1);
}

const hex = createHash('sha256').update(`smoke|${hostname()}`).digest('hex').slice(0, 20);
const hwid = `omni-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}`;

const sb = createClient(url, key, { auth: { persistSession: false } });
const { error } = await sb.from('devices').upsert({
  hwid,
  display_name: 'Smoke Test Device',
  user_alias: 'Smoke Test Device',
  os: process.platform,
  cpu: 'smoke',
  status: 'active',
  last_ping: new Date().toISOString(),
});

if (error) {
  console.error('Upsert failed — run schema.sql + schema-delta.sql in Supabase SQL editor first.');
  console.error(error.message);
  process.exit(1);
}
console.log('OK device registered:', hwid);
