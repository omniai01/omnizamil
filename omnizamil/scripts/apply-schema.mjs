/**
 * Apply supabase/schema.sql using DATABASE_URL (optional) or print instructions.
 * Prefer: paste schema.sql into Supabase Dashboard → SQL Editor → Run.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, '..', 'supabase', 'schema.sql');
const sql = fs.readFileSync(schemaPath, 'utf8');

const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!dbUrl || dbUrl.includes('[YOUR-PASSWORD]')) {
  console.log(`
Omni-Removal — create the database tables once:

1. Open https://supabase.com/dashboard/project/udwjdqzlkhtklsvedblg/sql/new
2. Paste the contents of: supabase/schema.sql
3. Click Run

Then start:
  - Desktop:  npm start          (omnizamil/)
  - Admin:    npm run dev        (omnizamil/admin/)  password from admin/.env

Optional: set DATABASE_URL=postgresql://postgres:PASSWORD@db.udwjdqzlkhtklsvedblg.supabase.co:5432/postgres
and re-run: node scripts/apply-schema.mjs
`);
  process.exit(0);
}

const { default: pg } = await import('pg').catch(() => ({ default: null }));
if (!pg) {
  console.error('Install pg first: npm i pg');
  process.exit(1);
}

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query(sql);
await client.end();
console.log('Schema applied successfully.');
