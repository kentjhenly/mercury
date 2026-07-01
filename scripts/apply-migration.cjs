// Applies a single .sql migration file to the remote database via DATABASE_URL
// from .env.local, through the pooled connection (consistent with how the
// reference codebase applies migrations).
//
// Usage: node scripts/apply-migration.cjs supabase/migrations/00XX_name.sql
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const envPath = path.resolve(".env.local");
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, "utf8");
  for (const line of envFile.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
  }
}

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/apply-migration.cjs <path-to-sql>");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set (add it to .env.local).");
  process.exit(1);
}

const sql = fs.readFileSync(path.resolve(file), "utf8");
const client = new Client({ connectionString: process.env.DATABASE_URL });

(async () => {
  await client.connect();
  try {
    await client.query(sql);
    console.log(`Applied ${file}`);
  } finally {
    await client.end();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
