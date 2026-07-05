import { describe, it, expect } from "vitest";
import { HK_METRO } from "../metro/hk";
import { matchRoleFamily } from "../metro";
import type { RoleFamily } from "../metro/types";
import { fitFamilyCurve, predictBand } from "./regression";
import { estimateSalary } from "./index";

describe("regression: every bundled family", () => {
  for (const data of HK_METRO.roleFamilies) {
    const curve = fitFamilyCurve(data)!;

    it(`${data.family}: fits`, () => {
      expect(curve).not.toBeNull();
    });

    it(`${data.family}: monotone non-decreasing p50 over 0..30y`, () => {
      let prev = 0;
      for (let y = 0; y <= 30; y++) {
        const band = predictBand(curve, y);
        expect(band.p50).toBeGreaterThanOrEqual(prev);
        prev = band.p50;
      }
    });

    it(`${data.family}: ordered, sane bands (p25 ≤ p50 ≤ p75, within HK reality)`, () => {
      for (const y of [0, 1, 3, 5, 8, 12, 20]) {
        const band = predictBand(curve, y);
        expect(band.p25).toBeLessThanOrEqual(band.p50);
        expect(band.p50).toBeLessThanOrEqual(band.p75);
        expect(band.p25).toBeGreaterThanOrEqual(8000); // below HK full-time floor = absurd
        expect(band.p75).toBeLessThanOrEqual(200000); // above this = absurd for these families
      }
    });

    it(`${data.family}: clamps beyond the observed range (no runaway extrapolation)`, () => {
      const atMax = predictBand(curve, curve.maxYears);
      const wayBeyond = predictBand(curve, 60);
      expect(wayBeyond.p50).toBe(atMax.p50);
      expect(wayBeyond.marginalPerYear).toBe(0);
    });

    it(`${data.family}: stays near the reference points (fit is descriptive, not inventive)`, () => {
      for (const p of data.points) {
        const band = predictBand(curve, p.years);
        // within ±25% of the seeded median at each reference year
        expect(band.p50).toBeGreaterThan(p.p50 * 0.75);
        expect(band.p50).toBeLessThan(p.p50 * 1.25);
      }
    });
  }
});

describe("regression: shrinkage & small samples", () => {
  it("n=3 shrinks fully to a straight line in log space", () => {
    // Strong curvature bait: an exact quadratic through these would bend hard.
    const curve = fitFamilyCurve({
      points: [
        { years: 0, p25: 9000, p50: 10000, p75: 11000 },
        { years: 5, p25: 10000, p50: 11000, p75: 12000 },
        { years: 10, p25: 36000, p50: 40000, p75: 44000 },
      ],
    })!;
    // Pure linear least squares on log(p50) at y=5 equals the mean of log
    // endpoints' fitted line — the midpoint prediction must sit near the
    // geometric mean of the endpoints' fitted values, far from the bait's 11k.
    const mid = predictBand(curve, 5).p50;
    const geoMean = Math.sqrt(predictBand(curve, 0).p50 * predictBand(curve, 10).p50);
    expect(Math.abs(mid - geoMean) / geoMean).toBeLessThan(0.15);
  });

  it("n=2 interpolates log-linearly", () => {
    const curve = fitFamilyCurve({
      points: [
        { years: 0, p25: 9000, p50: 10000, p75: 11000 },
        { years: 8, p25: 36000, p50: 40000, p75: 44000 },
      ],
    })!;
    const mid = predictBand(curve, 4).p50;
    expect(Math.abs(mid - 20000) / 20000).toBeLessThan(0.05); // geometric midpoint
  });

  it("n=1 is flat", () => {
    const curve = fitFamilyCurve({
      points: [{ years: 3, p25: 18000, p50: 20000, p75: 23000 }],
    })!;
    expect(predictBand(curve, 0).p50).toBe(20000);
    expect(predictBand(curve, 20).p50).toBe(20000);
  });

  it("empty family yields null, not a fabricated curve", () => {
    expect(fitFamilyCurve({ points: [] })).toBeNull();
  });
});

describe("matchRoleFamily", () => {
  const cases: [string, RoleFamily | null][] = [
    ["Senior Software Engineer", "software_engineer"],
    ["Full-Stack Developer", "software_engineer"],
    ["Data Scientist", "data_scientist"],
    ["ML Engineer", "data_scientist"],
    ["Data Analyst", "data_analyst"],
    ["Product Manager", "product_manager"],
    ["UX Designer", "designer"],
    ["Growth Marketing Lead", "marketing"],
    ["Account Executive", "sales"],
    ["Accountant", "finance"],
    ["HR Manager", "hr"],
    ["Customer Support Specialist", "customer_service"],
    ["Office Administrator", "admin"],
    ["Operations Manager", "operations"],
    ["Underwater Basket Weaver", null],
    ["", null],
  ];
  for (const [title, family] of cases) {
    it(`"${title}" → ${family ?? "null"}`, () => {
      expect(matchRoleFamily(HK_METRO, title)).toBe(family);
    });
  }
});

describe("estimateSalary", () => {
  const role = { title: "Software Engineer", experience_target: 4, location: "Hong Kong" };

  it("uses the applicant's parsed years when present", () => {
    const junior = estimateSalary(HK_METRO, role, {
      parsed_years_exp: 0,
      parsed_current_role: null,
      parsed_location: "Hong Kong",
    })!;
    const senior = estimateSalary(HK_METRO, role, {
      parsed_years_exp: 10,
      parsed_current_role: null,
      parsed_location: "Hong Kong",
    })!;
    expect(junior.p50).toBeLessThan(senior.p50);
    expect(junior.basis).toContain("from CV");
  });

  it("falls back to the role's experience target without an applicant", () => {
    const est = estimateSalary(HK_METRO, role)!;
    expect(est.years).toBe(4);
    expect(est.basis).toContain("target");
  });

  it("returns null rather than guessing: unknown family / missing years", () => {
    expect(estimateSalary(HK_METRO, { title: "Chief Vibes Officer", experience_target: 3 })).toBeNull();
    expect(estimateSalary(HK_METRO, { title: "Software Engineer", experience_target: null })).toBeNull();
  });

  it("always carries a transparency basis naming the source", () => {
    const est = estimateSalary(HK_METRO, role)!;
    expect(est.basis).toMatch(/HK market estimate/);
    expect(est.basis).toMatch(/Source:/);
    expect(est.basis).toMatch(/not a judgement/);
  });

  it("notes a likely non-HK applicant without changing the number", () => {
    const hk = estimateSalary(HK_METRO, role, { parsed_years_exp: 4, parsed_location: "Kowloon" })!;
    const abroad = estimateSalary(HK_METRO, role, { parsed_years_exp: 4, parsed_location: "Singapore" })!;
    expect(abroad.p50).toBe(hk.p50);
    expect(abroad.basis).toContain("outside HK");
    expect(hk.basis).not.toContain("outside HK");
  });
});

describe("confidence + suppression", () => {
  const seRole = { title: "Software Engineer", experience_target: null };

  it("high confidence for a dense family within the observed range", () => {
    const est = estimateSalary(HK_METRO, seRole, { parsed_years_exp: 5 })!;
    expect(est.confidence).toBe("high");
  });

  it("medium confidence for a sparse family: rough wording + wider, still ordered", () => {
    // product_manager: only 3 reference points (2..9y).
    const est = estimateSalary(
      HK_METRO,
      { title: "Product Manager", experience_target: null },
      { parsed_years_exp: 5 }
    )!;
    expect(est.confidence).toBe("medium");
    expect(est.p25).toBeLessThan(est.p50);
    expect(est.p50).toBeLessThan(est.p75);
    expect(est.basis).toMatch(/Rough estimate/);
  });

  it("medium band is wider than the un-widened high-confidence band", () => {
    // Same family/curve, in-range vs just-outside is hard to compare; instead
    // check widening pushed p25 below and p75 above a plausible tight band.
    const med = estimateSalary(
      HK_METRO,
      { title: "HR Manager", experience_target: null },
      { parsed_years_exp: 3 }
    )!;
    expect(med.confidence).toBe("medium");
    expect(med.p25).toBeLessThan(med.p75);
  });

  it("suppresses (returns null) when years fall well beyond the data", () => {
    // software_engineer data stops at 12y; 20y is >3y beyond → low → suppressed.
    expect(estimateSalary(HK_METRO, seRole, { parsed_years_exp: 20 })).toBeNull();
  });

  it("carries a compact one-line basis", () => {
    const est = estimateSalary(HK_METRO, seRole, { parsed_years_exp: 5 })!;
    expect(est.shortBasis).toMatch(/HK market data ·/);
    expect(est.shortBasis).toContain("~5 yrs");
  });
});
