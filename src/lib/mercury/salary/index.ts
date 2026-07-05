// Market salary context — the thin public API. Pure local computation over a
// metro's bundled reference data (no external call, no applicant data leaves the
// server/browser). Output is *information about the market* for a role family +
// experience level; it is never a judgement of an applicant and must never be
// used to score, rank, or hide anyone.
//
// The market is a parameter (MetroConfig), not a hard-coded assumption: pass the
// role's metro (via getMetro(role.metro_id)) and currency/period/labels flow
// from there. Only hk.ts knows it's Hong Kong.

import type { MetroConfig, RoleFamily, RoleFamilyData, SalaryConfidence } from "../metro/types";
import { matchRoleFamilyData, locationInMetro } from "../metro";
import { fitFamilyCurve, predictBand, roundMoney, type FittedCurve, type SalaryBand } from "./regression";

export interface SalaryEstimate extends SalaryBand {
  family: RoleFamily;
  /** Years of experience the estimate was computed at (clamped in the fit). */
  years: number;
  /**
   * Trust level of this band. Only `high` | `medium` are ever returned — a
   * `low`-confidence result is suppressed (estimateSalary returns null) so the
   * UI shows "unavailable" rather than a number we don't stand behind. A
   * `medium` band has already been widened for display.
   */
  confidence: Exclude<SalaryConfidence, "low">;
  /** Full transparency string — shown with the number (source + reassurance). */
  basis: string;
  /** Compact one-line basis, e.g. "HK market data · software roles · ~5 yrs". */
  shortBasis: string;
}

/**
 * Confidence in a band, from sample size (n reference points) and whether the
 * queried years sit inside the observed data range. Reuses exactly the inputs
 * the shrinkage/clamp already depend on — n and [minYears, maxYears].
 *   high   — enough points AND the years are within the observed range.
 *   medium — 3+ points, at most lightly outside the range (clamped ≤3 yrs).
 *   low    — too few points, or years well beyond the data (→ suppressed).
 */
function deriveConfidence(n: number, curve: FittedCurve, years: number): SalaryConfidence {
  const overshoot =
    years < curve.minYears
      ? curve.minYears - years
      : years > curve.maxYears
        ? years - curve.maxYears
        : 0;
  if (n < 3 || overshoot > 3) return "low";
  if (n >= 4 && overshoot === 0) return "high";
  return "medium";
}

// Curves are deterministic per family; fit once per process. Keyed on the family
// data object (module-level constants), so this never grows unbounded.
const curveCache = new WeakMap<RoleFamilyData, FittedCurve | null>();
function curveFor(fam: RoleFamilyData): FittedCurve | null {
  let curve = curveCache.get(fam);
  if (curve === undefined) {
    curve = fitFamilyCurve(fam);
    curveCache.set(fam, curve);
  }
  return curve;
}

interface RoleLike {
  title: string;
  experience_target: number | null;
  location?: string | null;
}

interface ApplicantLike {
  parsed_years_exp: number | null;
  parsed_current_role?: string | null;
  parsed_location?: string | null;
}

/**
 * Market estimate for a role (and optionally a specific applicant's experience
 * level) in the given metro. Returns null when the role family is unknown or no
 * experience figure exists — callers show "market estimate unavailable", never a
 * made-up number.
 *
 * Family comes from the role title (fallback: the applicant's parsed current
 * role). Years come from the applicant's parsed CV (fallback: the role's
 * experience target).
 */
export function estimateSalary(
  metro: MetroConfig,
  role: RoleLike,
  applicant?: ApplicantLike
): SalaryEstimate | null {
  const fam =
    matchRoleFamilyData(metro, role.title) ??
    matchRoleFamilyData(metro, applicant?.parsed_current_role);
  if (!fam) return null;

  const years = applicant?.parsed_years_exp ?? role.experience_target;
  if (years == null || years < 0) return null;

  const curve = curveFor(fam);
  if (!curve) return null;

  // Suppress rather than guess: a low-confidence band is never shown.
  const confidence = deriveConfidence(fam.points.length, curve, years);
  if (confidence === "low") return null;

  const band = predictBand(curve, years);
  // A medium (rougher) estimate reads visibly wider — pad the displayed band.
  if (confidence === "medium") {
    band.p25 = roundMoney(band.p25 * (1 - metro.bandWidenFactor));
    band.p75 = roundMoney(band.p75 * (1 + metro.bandWidenFactor));
  }

  const yearsShort = `~${years} yr${years === 1 ? "" : "s"}`;
  const yearsNote =
    applicant?.parsed_years_exp != null
      ? `${yearsShort} experience (from CV)`
      : `the role's ~${years} yr target`;
  let basis = `${metro.marketLabel} estimate for ${fam.label} at ${yearsNote}.`;
  if (confidence === "medium") basis += " Rough estimate — few reference points at this level.";
  basis += ` Source: ${fam.source}.`;
  if (applicant?.parsed_location && !locationInMetro(metro, applicant.parsed_location)) {
    basis += ` Applicant may be based outside ${metro.shortName}; ${metro.marketLabel} shown.`;
  }
  basis += " Context only — not a judgement of any applicant.";

  const shortBasis = `${metro.marketLabel} data · ${fam.label} · ${yearsShort}`;

  return { ...band, family: fam.family, years, confidence, basis, shortBasis };
}

// ── Currency/period formatting (the only place currency literals live) ───────

function periodSuffix(metro: MetroConfig): string {
  return metro.salaryPeriod === "annual" ? "/yr" : "/mo";
}

function compactK(v: number): string {
  const k = v / 1000;
  return k >= 100 ? String(Math.round(k)) : String(Math.round(k * 2) / 2);
}

/** "HK$42K" — compact single figure for tight UI. */
export function formatMoneyCompact(metro: MetroConfig, v: number): string {
  return `${metro.currencySymbol}${compactK(v)}K`;
}

/** "HK$34–52K/mo" — the p25–p75 band, compact, with the metro's period suffix. */
export function formatSalaryBand(metro: MetroConfig, band: SalaryBand): string {
  return `${metro.currencySymbol}${compactK(band.p25)}–${compactK(band.p75)}K${periodSuffix(metro)}`;
}

/** "HK$42,000" — full figure where space allows, localized to the metro. */
export function formatSalaryFull(metro: MetroConfig, v: number): string {
  return `${metro.currencySymbol}${v.toLocaleString(metro.locale)}`;
}
