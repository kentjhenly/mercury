import { detectSkills } from "./skills";

// Free, local CV parsing. PDF/DOCX text extraction via open libraries (no paid
// document AI), then transparent heuristic field extraction. Everything here
// only *surfaces facts the human can verify against the original CV* — it never
// scores or judges. On any failure callers set needs_review and keep the card.

export interface ParsedFields {
  years_exp: number | null;
  skills: string[];
  current_role: string | null;
  location: string | null;
}

export interface ExtractResult {
  text: string;
  ok: boolean;
}

/**
 * Extract plain text from a CV attachment buffer. Supports PDF and DOCX (the two
 * formats real applicants send); falls back to UTF-8 for text/plain. Returns
 * ok:false (and whatever text we managed) so the caller flags needs_review
 * without dropping the applicant.
 */
export async function extractText(
  buffer: Buffer,
  filename: string,
  contentType?: string | null
): Promise<ExtractResult> {
  const lower = filename.toLowerCase();
  const ct = (contentType ?? "").toLowerCase();
  try {
    if (lower.endsWith(".pdf") || ct.includes("pdf")) {
      const pdfParse = (await import("pdf-parse")).default as (b: Buffer) => Promise<{ text: string }>;
      const data = await pdfParse(buffer);
      return { text: data.text ?? "", ok: Boolean(data.text && data.text.trim()) };
    }
    if (lower.endsWith(".docx") || ct.includes("officedocument.wordprocessingml")) {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.extractRawText({ buffer });
      return { text: value ?? "", ok: Boolean(value && value.trim()) };
    }
    if (lower.endsWith(".txt") || ct.startsWith("text/")) {
      const text = buffer.toString("utf8");
      return { text, ok: Boolean(text.trim()) };
    }
  } catch (err) {
    console.error("[parse.extractText]", filename, err);
    return { text: "", ok: false };
  }
  // Unknown/binary (e.g. legacy .doc, scanned image) — no free extractor here.
  return { text: "", ok: false };
}

const LOCATIONS = [
  "Hong Kong", "Kowloon", "Central", "Tsim Sha Tsui", "Singapore", "Shenzhen",
  "Shanghai", "Beijing", "Taipei", "Tokyo", "Seoul", "London", "New York",
  "San Francisco", "Sydney", "Melbourne", "Toronto", "Berlin", "Remote",
];

const TITLE_KEYWORDS = [
  "engineer", "developer", "designer", "manager", "analyst", "scientist",
  "consultant", "specialist", "lead", "architect", "director", "officer",
  "administrator", "coordinator", "associate", "intern", "marketer",
  "accountant", "recruiter", "founder", "owner",
];

// A CV's useful facts are near the top; extracted text from a large PDF/DOCX can
// be megabytes. Cap what the heuristics scan so an oversized (or adversarial)
// attachment can't turn parsing into a CPU-exhaustion lever on the inbound path.
const MAX_PARSE_CHARS = 200_000;

/** Pull factual fields out of extracted CV text. Missing fields stay null. */
export function parseCvText(text: string, requiredSkills: string[] = []): ParsedFields {
  const clean = (text ?? "").slice(0, MAX_PARSE_CHARS).replace(/\r/g, "");
  return {
    years_exp: extractYears(clean),
    skills: detectSkills(clean, requiredSkills),
    current_role: extractCurrentRole(clean),
    location: extractLocation(clean),
  };
}

function extractYears(text: string): number | null {
  let best: number | null = null;
  // "5+ years", "5 years of experience", "over 7 years"
  const re = /(\d{1,2})\s*\+?\s*years?(?:\s+of)?(?:\s+(?:professional|relevant|industry|work))?\s*experience?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n) && n <= 50 && (best === null || n > best)) best = n;
  }
  if (best !== null) return best;

  // Fall back to estimating from the earliest 4-digit year mentioned in a
  // plausible employment range (20xx / 19xx), capped sanely.
  const years = [...text.matchAll(/\b(19[89]\d|20[0-3]\d)\b/g)].map((x) => parseInt(x[1], 10));
  if (years.length) {
    const earliest = Math.min(...years);
    const now = new Date().getFullYear();
    const span = now - earliest;
    if (span >= 0 && span <= 50) return span;
  }
  return null;
}

function extractCurrentRole(text: string): string | null {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.length > 80) continue;
    const lower = line.toLowerCase();
    if (TITLE_KEYWORDS.some((k) => lower.includes(k))) {
      // Trim trailing company/date noise after a separator.
      const role = line.split(/\s[–—|@]\s|\s+at\s+|,/i)[0].trim();
      if (role.length >= 2 && role.length <= 60) return role;
    }
  }
  return null;
}

// Precompiled once at module load — extractLocation runs on every ingest, so
// there's no reason to rebuild these regexes per call.
const LOCATION_MATCHERS = LOCATIONS.map((loc) => ({
  loc,
  re: new RegExp(`(^|[^a-z])${loc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`, "i"),
}));

function extractLocation(text: string): string | null {
  for (const { loc, re } of LOCATION_MATCHERS) {
    if (re.test(text)) return loc;
  }
  return null;
}

/** First email address found in text (used as a fallback when the email
 * envelope sender is missing). */
export function firstEmail(text: string): string | null {
  const m = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  return m?.[0] ?? null;
}
