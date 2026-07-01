import type { MercuryApplicant, MercuryRole } from "@/lib/supabase/types";
import { canonicalizeSkill } from "./skills";

// Transparent "relevance to this role" sort AID. This is NOT a score that
// judges or hides anyone — it's an optional, human-invoked ordering whose
// criterion is shown in plain language, and it never removes a card from view.
// Deliberately a simple, explainable overlap of visible facts (no black box).

export interface Relevance {
  score: number; // 0..1, for ordering only
  matchedSkills: string[];
  reason: string; // human-readable criterion shown in the UI
}

export function computeRelevance(applicant: MercuryApplicant, role: MercuryRole): Relevance {
  const required = role.required_skills.map(canonicalizeSkill);
  const have = new Set(applicant.parsed_skills.map(canonicalizeSkill).map((s) => s.toLowerCase()));
  const matched = required.filter((s) => have.has(s.toLowerCase()));

  let skillScore = 0;
  if (required.length > 0) skillScore = matched.length / required.length;
  else skillScore = Math.min(1, applicant.parsed_skills.length / 8);

  // Experience proximity to the target (gentle, capped) — purely a tie-breaker.
  let expScore = 0;
  if (role.experience_target != null && applicant.parsed_years_exp != null) {
    const diff = Math.abs(applicant.parsed_years_exp - role.experience_target);
    expScore = Math.max(0, 1 - diff / 8);
  }

  const score = role.experience_target != null ? skillScore * 0.8 + expScore * 0.2 : skillScore;

  const reason =
    required.length > 0
      ? `${matched.length}/${required.length} required skills present${
          matched.length ? `: ${matched.join(", ")}` : ""
        }`
      : `${applicant.parsed_skills.length} skills detected`;

  return { score, matchedSkills: matched, reason };
}
