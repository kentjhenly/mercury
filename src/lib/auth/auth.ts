import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { sendWelcomeEmail } from "@/lib/email/send";

// Reuse one pool across hot reloads — Turbopack re-evaluates this module on
// every change, and a fresh Pool each time leaks connections until the Supabase
// session-mode pooler hits its client cap. `max` stays below that cap.
const globalForPool = globalThis as unknown as { __mercuryAuthPool?: Pool };
const pool =
  globalForPool.__mercuryAuthPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL!,
    max: 3,
    min: 0,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  });
if (process.env.NODE_ENV !== "production") globalForPool.__mercuryAuthPool = pool;

export const auth = betterAuth({
  database: pool,
  // Downgrade transient pooler errors (dropped idle sockets / connect timeouts)
  // to warnings so they don't trip the Next.js dev error overlay as if fatal.
  logger: {
    log: (level, message, ...args) => {
      const extra = args
        .map((a) => (a instanceof Error ? a.message : typeof a === "object" ? JSON.stringify(a) : String(a)))
        .filter(Boolean)
        .join(" ");
      const text = `[Better Auth]: ${message}${extra ? ` ${extra}` : ""}`;
      const transient =
        /timeout exceeded when trying to connect|fallback join|ECONNRESET|ETIMEDOUT|Connection terminated/i.test(text);
      if (transient || level === "warn") return void console.warn(text);
      if (level === "error") return void console.error(text);
      if (level === "debug") return void console.debug(text);
      console.info(text);
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  // Throttle auth endpoints to blunt credential brute-forcing and signup abuse.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
      "/change-password": { window: 60, max: 5 },
      "/forget-password": { window: 60, max: 3 },
      "/reset-password": { window: 60, max: 5 },
    },
  },
  session: {
    // Serve the common getServerSession call from a short-lived signed cookie
    // instead of a Postgres round-trip on every navigation.
    cookieCache: {
      enabled: true,
      maxAge: 300,
    },
  },
  user: {
    additionalFields: {
      // Mercury is employer-only for now; default the role so existing helpers
      // and any future candidate role still work.
      role: { type: "string", required: false, input: false },
      display_name: { type: "string", required: false, input: true },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const { id, name, email, display_name } = user as typeof user & {
            display_name?: string;
          };
          // Create the employer workspace record. reply_to defaults to the
          // login email; the employer can change it in settings.
          await pool.query(
            `insert into mercury_employers (id, company_name, reply_to)
             values ($1, $2, $3)
             on conflict (id) do nothing`,
            [id, display_name ?? name ?? null, email]
          );

          sendWelcomeEmail({ to: email, name: display_name ?? name }).catch((err) =>
            console.error("sendWelcomeEmail failed:", err)
          );
        },
      },
    },
  },
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://localhost:3000"],
  advanced: {
    crossSubDomainCookies: { enabled: false },
  },
});

export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
