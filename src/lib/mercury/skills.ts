// Skill synonym normalization — the ONLY ML-adjacent touch in Mercury, and it
// only *organizes* (canonicalizes "JS" → "JavaScript"). It never judges, scores,
// ranks-as-judgement, or hides a candidate. Deliberately a transparent lookup
// table, not a model, so the behavior is inspectable.

// canonical -> aliases (all compared case-insensitively, punctuation-insensitive)
const SYNONYMS: Record<string, string[]> = {
  JavaScript: ["js", "java script", "ecmascript", "es6", "es2015"],
  TypeScript: ["ts"],
  "Node.js": ["node", "nodejs", "node js"],
  React: ["reactjs", "react.js"],
  "Next.js": ["next", "nextjs"],
  "Vue.js": ["vue", "vuejs"],
  Python: ["py"],
  PostgreSQL: ["postgres", "psql", "postgresql"],
  "C#": ["c sharp", "csharp"],
  "C++": ["cpp", "cplusplus"],
  Golang: ["go", "go lang"],
  Kubernetes: ["k8s"],
  "CI/CD": ["cicd", "ci cd"],
  "Machine Learning": ["ml", "machine-learning"],
  "REST APIs": ["rest", "restful", "rest api"],
  AWS: ["amazon web services"],
  GCP: ["google cloud", "google cloud platform"],
  "UI/UX": ["uiux", "ui ux", "ux/ui"],
};

// A general skill vocabulary used to detect skills present in CV text even when
// a role didn't list them. Combined with each role's required_skills at call time.
export const GENERAL_SKILLS: string[] = [
  "JavaScript", "TypeScript", "Node.js", "React", "Next.js", "Vue.js", "Angular",
  "Python", "Django", "Flask", "FastAPI", "Java", "Spring", "Kotlin", "Swift",
  "C#", ".NET", "C++", "C", "Golang", "Rust", "Ruby", "Rails", "PHP", "Laravel",
  "SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis", "GraphQL", "REST APIs",
  "AWS", "GCP", "Azure", "Docker", "Kubernetes", "Terraform", "CI/CD",
  "HTML", "CSS", "Tailwind", "Sass", "Figma", "UI/UX",
  "Machine Learning", "TensorFlow", "PyTorch", "Pandas", "NumPy",
  "Excel", "Tableau", "Power BI", "Salesforce", "SAP",
  "Project Management", "Agile", "Scrum", "Git",
];

// Reverse index: lowercased alias/canonical -> canonical.
const CANON: Map<string, string> = (() => {
  const m = new Map<string, string>();
  const add = (alias: string, canon: string) => m.set(normalizeToken(alias), canon);
  for (const canon of GENERAL_SKILLS) add(canon, canon);
  for (const [canon, aliases] of Object.entries(SYNONYMS)) {
    add(canon, canon);
    for (const a of aliases) add(a, canon);
  }
  return m;
})();

function normalizeToken(s: string): string {
  return s.toLowerCase().replace(/[._/\\+#-]/g, " ").replace(/\s+/g, " ").trim();
}

/** Canonicalize a single skill label; returns the input trimmed if unknown. */
export function canonicalizeSkill(skill: string): string {
  return CANON.get(normalizeToken(skill)) ?? skill.trim();
}

/** Canonicalize + de-duplicate a list of skill labels. */
export function canonicalizeSkills(skills: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of skills) {
    const c = canonicalizeSkill(s);
    const key = c.toLowerCase();
    if (!c || seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

/**
 * Detect which skills from a candidate vocabulary appear in free CV text. Uses
 * word-boundary matching on canonical names + known aliases. Pure string match —
 * no scoring, no inference about competence.
 */
export function detectSkills(text: string, vocabulary: string[]): string[] {
  if (!text) return [];
  const hay = ` ${text.toLowerCase().replace(/[\n\r\t]/g, " ")} `;
  const found = new Set<string>();
  const vocab = canonicalizeSkills([...vocabulary, ...GENERAL_SKILLS]);

  for (const canon of vocab) {
    const variants = new Set<string>([canon, ...(SYNONYMS[canon] ?? [])]);
    for (const v of variants) {
      const needle = v.toLowerCase().trim();
      if (!needle) continue;
      // Escape regex specials in the skill name, allow flexible separators.
      const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, "i");
      if (re.test(hay)) {
        found.add(canon);
        break;
      }
    }
  }
  return [...found];
}
