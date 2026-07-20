// Metro registry + the market-agnostic matching helpers. `getMetro` is the
// single call site that resolves a role's `metro_id` to its config; today it
// only ever returns Hong Kong, but every read defaults through here so adding a
// second metro is a data change, not a code change.

import type { MetroConfig, RoleFamilyData } from "./types";
import { HK_METRO } from "./hk";

export type { MetroConfig, RoleFamily, RoleFamilyData, SalaryPoint, SalaryPeriod } from "./types";

const METROS: Record<string, MetroConfig> = {
  [HK_METRO.id]: HK_METRO,
};

/** The default metro when a role has no (or an unknown) `metro_id`. */
export const DEFAULT_METRO_ID = HK_METRO.id;

/**
 * Resolve a metro config. Null/undefined/unknown ids fall back to the default
 * metro (HK) — reads never fail on a missing `metro_id`.
 */
export function getMetro(id?: string | null): MetroConfig {
  if (id && Object.prototype.hasOwnProperty.call(METROS, id)) return METROS[id];
  return METROS[DEFAULT_METRO_ID];
}

// Compiled title/location matchers, cached per config object (configs are
// module-level constants, so a WeakMap keyed on them never grows unbounded).
const familyRe = new WeakMap<RoleFamilyData, RegExp>();
const locationRe = new WeakMap<MetroConfig, RegExp>();

function familyRegex(fam: RoleFamilyData): RegExp {
  let re = familyRe.get(fam);
  if (!re) {
    re = new RegExp(fam.aliases.join("|"));
    familyRe.set(fam, re);
  }
  return re;
}

// Normalize a free-text title before matching: lowercase, punctuation → spaces,
// collapse whitespace. Mirrors the old skills-style keyword lookup exactly.
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[/_,()-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Map a free-text role title (role.title or applicant.parsed_current_role) to a
 * known role family for this metro, or null when nothing matches. Callers must
 * treat null as "market estimate unavailable", never guess.
 */
export function matchRoleFamilyData(
  metro: MetroConfig,
  title: string | null | undefined
): RoleFamilyData | null {
  if (!title) return null;
  const t = normalizeTitle(title);
  if (!t) return null;
  for (const fam of metro.roleFamilies) {
    if (familyRegex(fam).test(t)) return fam;
  }
  return null;
}

/**
 * Whether a free-text location reads as inside this metro. Used only to add a
 * transparency note to the basis — it never changes the estimate.
 */
export function locationInMetro(metro: MetroConfig, location: string | null | undefined): boolean {
  if (!location) return false;
  let re = locationRe.get(metro);
  if (!re) {
    re = new RegExp(metro.locationAliases.join("|"), "i");
    locationRe.set(metro, re);
  }
  return re.test(location);
}
