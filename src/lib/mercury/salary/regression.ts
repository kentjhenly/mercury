// Local Mincer-style salary curve — ported from the earlier The Job Market
// design. log(salary) ~ years + years², with sample-size shrinkage on the
// quadratic term (few reference points → shrink toward a straight line),
// enforced monotonicity, and clamping beyond the observed experience range.
// Pure math over the bundled reference points: no API, no model, no applicant
// data leaves the process.

import type { SalaryPoint } from "../metro/types";

export interface SalaryBand {
  /** Money per period (currency/period from the metro), rounded to the nearest
   *  500 — never fake precision. */
  p25: number;
  p50: number;
  p75: number;
  /** Approximate money-per-period gained per additional year at this point (p50). */
  marginalPerYear: number;
}

// Blend weight for the quadratic fit: w = (n-3) / (n-3 + SHRINK_K). At n=3 the
// quadratic interpolates its inputs exactly, so it gets zero weight (pure
// linear); confidence in curvature grows with more points.
const SHRINK_K = 4;

const GRID_STEP = 0.5;
const ROUND_TO = 500;

/** Solve a small symmetric linear system A·x = b by Gaussian elimination. */
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (Math.abs(M[pivot][col]) < 1e-12) return null;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / M[i][i]);
}

/** Least-squares polynomial fit of log(p50) on years; degree 1 or 2. */
function fitLog(points: SalaryPoint[], degree: 1 | 2): number[] | null {
  const n = degree + 1;
  const A = Array.from({ length: n }, () => new Array(n).fill(0));
  const b = new Array(n).fill(0);
  for (const p of points) {
    const ly = Math.log(p.p50);
    for (let i = 0; i < n; i++) {
      b[i] += ly * Math.pow(p.years, i);
      for (let j = 0; j < n; j++) A[i][j] += Math.pow(p.years, i + j);
    }
  }
  return solve(A, b);
}

function evalPoly(coeffs: number[], y: number): number {
  return coeffs.reduce((acc, c, i) => acc + c * Math.pow(y, i), 0);
}

export interface FittedCurve {
  minYears: number;
  maxYears: number;
  /** Monotone p50 lookup table over [minYears, maxYears] at GRID_STEP. */
  grid: number[];
  /** Mean log-offsets of p25/p75 from p50 across the reference points. */
  r25: number;
  r75: number;
}

/**
 * Fit the family curve. n=1 → flat, n=2 → linear, n>=3 → linear/quadratic
 * blend with the quadratic weighted by sample size. The result is a monotone
 * non-decreasing p50 table (running max over a fine grid), clamped to the
 * observed years range.
 */
export function fitFamilyCurve(family: { points: SalaryPoint[] }): FittedCurve | null {
  const points = [...family.points].sort((a, b) => a.years - b.years);
  if (points.length === 0) return null;

  const minYears = points[0].years;
  const maxYears = points[points.length - 1].years;

  let logP50: (y: number) => number;
  if (points.length === 1) {
    const c = Math.log(points[0].p50);
    logP50 = () => c;
  } else {
    const linear = fitLog(points, 1);
    if (!linear) return null;
    const quad = points.length >= 3 ? fitLog(points, 2) : null;
    const w = quad ? (points.length - 3) / (points.length - 3 + SHRINK_K) : 0;
    logP50 = (y) => (1 - w) * evalPoly(linear, y) + (quad ? w * evalPoly(quad, y) : 0);
  }

  // Percentile band as a multiplicative offset from p50 — keeps p25 ≤ p50 ≤ p75
  // by construction, whatever the fit does.
  const r25 = points.reduce((s, p) => s + Math.log(p.p25 / p.p50), 0) / points.length;
  const r75 = points.reduce((s, p) => s + Math.log(p.p75 / p.p50), 0) / points.length;

  // Monotone, non-negative grid via running max.
  const grid: number[] = [];
  let prev = 0;
  for (let y = minYears; y <= maxYears + 1e-9; y += GRID_STEP) {
    const v = Math.max(prev, Math.exp(logP50(y)));
    grid.push(v);
    prev = v;
  }

  return { minYears, maxYears, grid, r25: Math.min(r25, 0), r75: Math.max(r75, 0) };
}

function p50At(curve: FittedCurve, years: number): number {
  // Clamp beyond the observed range — never extrapolate.
  const y = Math.min(Math.max(years, curve.minYears), curve.maxYears);
  const t = (y - curve.minYears) / GRID_STEP;
  const i = Math.min(Math.floor(t), curve.grid.length - 1);
  const j = Math.min(i + 1, curve.grid.length - 1);
  const frac = t - i;
  return curve.grid[i] * (1 - frac) + curve.grid[j] * frac;
}

export function roundMoney(v: number): number {
  return Math.max(0, Math.round(v / ROUND_TO) * ROUND_TO);
}

/** Predict the money band (metro currency/period) at a given experience level. */
export function predictBand(curve: FittedCurve, years: number): SalaryBand {
  const p50 = p50At(curve, years);
  const marginal = p50At(curve, years + 1) - p50;
  return {
    p25: roundMoney(p50 * Math.exp(curve.r25)),
    p50: roundMoney(p50),
    p75: roundMoney(p50 * Math.exp(curve.r75)),
    marginalPerYear: Math.round(Math.max(0, marginal)),
  };
}
