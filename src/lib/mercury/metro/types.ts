// Metro (market) configuration — the shape that makes Mercury's salary layer
// multi-local *by construction*. Only Hong Kong is built today (see hk.ts); the
// types exist so nothing in the regression/formatting code is hard-coded to a
// single market. A MetroConfig is pure, bundled reference data: no external
// call, no applicant data leaves the process, free forever.
//
// ML-organizes-never-judges note: this data describes a *market*, never an
// applicant. It must only ever be shown as context; never used to score, rank,
// or hide a candidate.

export type RoleFamily =
  | "software_engineer"
  | "data_scientist"
  | "data_analyst"
  | "product_manager"
  | "designer"
  | "marketing"
  | "sales"
  | "finance"
  | "hr"
  | "operations"
  | "customer_service"
  | "admin";

export interface SalaryPoint {
  /** Years of relevant experience this point describes. */
  years: number;
  /** Currency-per-period percentiles at that experience level (see MetroConfig). */
  p25: number;
  p50: number;
  p75: number;
}

export interface RoleFamilyData {
  /** Stable family key (shared across metros). */
  family: RoleFamily;
  /** Human label used in the transparency basis string. */
  label: string;
  /**
   * Title-match patterns. Each entry is a regex *fragment* tested (case-
   * insensitively, via pre-lowercasing) against the normalized role title; the
   * first family whose fragments match wins, so order families specific-first.
   * Kept as data so a new metro can extend/localize matching without code.
   */
  aliases: string[];
  /** Where the reference points came from — surfaced to the employer. */
  source: string;
  points: SalaryPoint[];
}

export type SalaryPeriod = "monthly" | "annual";

/**
 * How much to trust a computed band. Derived from sample size + whether the
 * queried experience sits inside the observed data range. `low` is never shown —
 * the estimate is suppressed instead (never fabricate precision).
 */
export type SalaryConfidence = "high" | "medium" | "low";

export interface MetroConfig {
  /** Stable id stored on roles (`mercury_roles.metro_id`). */
  id: string;
  /** Full market name, e.g. "Hong Kong". */
  name: string;
  /** Short market tag for tight UI / basis strings, e.g. "HK". */
  shortName: string;
  /** Human label for the market dataset, e.g. "HK market". */
  marketLabel: string;
  /** ISO currency code, e.g. "HKD". */
  currency: string;
  /** Currency symbol/prefix for display, e.g. "HK$". */
  currencySymbol: string;
  /** Whether salary figures are monthly or annual (drives the period suffix). */
  salaryPeriod: SalaryPeriod;
  /** BCP-47 locale for number formatting, e.g. "en-HK". */
  locale: string;
  /**
   * Fractional padding applied to a *medium*-confidence band before display
   * (p25 down, p75 up) so a rougher estimate reads visibly wider. e.g. 0.15.
   */
  bandWidenFactor: number;
  /**
   * Regex fragments identifying a location as inside this metro. Used only for a
   * transparency note — presence/absence never changes the number.
   */
  locationAliases: string[];
  roleFamilies: RoleFamilyData[];
}
