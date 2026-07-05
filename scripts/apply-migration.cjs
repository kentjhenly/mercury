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
    if (match) process.env[match[1]] = match[2].trim(); // .env.local always wins
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
// Debug: show masked URL so we can verify it's read correctly
const masked = process.env.DATABASE_URL.replace(/:([^@]+)@/, ":<PASSWORD>@");
console.log("Connecting to:", masked);

// TLS: verify the server certificate when a CA is available (set
// DATABASE_SSL_CA to the path of the Supabase project CA, downloadable from
// Dashboard → Settings → Database). Supabase's direct/pooled endpoints present a
// project CA that Node doesn't trust out of the box, so without one we fall back
// to encrypted-but-unverified — loudly, since this connection carries the DB
// admin credentials.
let ssl;
if (/\bsupabase\b|\bpooler\b/.test(process.env.DATABASE_URL)) {
  const caPath = process.env.DATABASE_SSL_CA;
  if (caPath && fs.existsSync(caPath)) {
    ssl = { ca: fs.readFileSync(caPath, "utf8"), rejectUnauthorized: true };
  } else {
    console.warn(
      "WARNING: TLS certificate verification is DISABLED for this connection. " +
        "Set DATABASE_SSL_CA to your Supabase project CA file to enable it."
    );
    ssl = { rejectUnauthorized: false };
  }
}

const sql = fs.readFileSync(path.resolve(file), "utf8");
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl,
});

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
