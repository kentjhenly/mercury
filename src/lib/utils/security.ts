// Shared input-hardening helpers used by Route Handlers.

/**
 * Turn a user/email-supplied attachment filename into a safe object-key segment.
 * Filenames flow into Supabase Storage keys; without sanitizing, a name like
 * `../../other/x` could escape the intended prefix. Keep a basename of a safe
 * character set, strip leading dots, and bound the length.
 */
export function sanitizeStorageFileName(name: string | null | undefined): string {
  const raw = (name ?? "").toString();
  const base = raw.split(/[/\\]/).pop() ?? "";
  const cleaned = base
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^[._-]+/, "")
    .slice(0, 128);
  return cleaned || "file";
}

/**
 * Coerce arbitrary input to a trimmed string capped at `max` characters, or null
 * when empty/non-string. Prevents unbounded text from being persisted.
 */
export function clampText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/**
 * Coerce a value to an integer within [min, max], or null when absent/invalid.
 * Used for bounded inputs like experience-target and years-of-experience.
 */
export function parseIntInRange(value: unknown, min: number, max: number): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.round(n);
  if (i < min || i > max) return null;
  return i;
}

/** Basic, length-bounded email shape check for stored/echoed addresses. */
export function isValidEmail(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const v = value.trim();
  return v.length > 0 && v.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
