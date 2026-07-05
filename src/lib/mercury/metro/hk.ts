// Hong Kong metro configuration — bundled, version-controlled, free. This is the
// ONLY market built today; everything HK-specific (currency, period, market
// labels, reference points, title aliases) lives here so the rest of the salary
// layer stays market-agnostic. Figures are MONTHLY HKD (the HK convention),
// seeded from public sources: HK Census & Statistics Department earnings tables
// (Annual Earnings and Hours Survey) cross-checked against public recruitment
// salary-guide ranges (Hays, Michael Page, Robert Walters, JobsDB/CTgoodjobs),
// 2024–25 editions. Each family carries a `source` note for transparency — the
// UI surfaces it so an estimate is never an unexplained number.
//
// Role-family order is specific-first: matching walks `roleFamilies` in order
// and takes the first hit, so "data scientist" must precede the broad
// "engineer" catch-all. Aliases are regex fragments (see RoleFamilyData).

import type { MetroConfig } from "./types";

const GUIDE_SOURCE =
  "public HK salary guides (Hays, Michael Page, Robert Walters) + C&SD earnings tables, 2024–25";

export const HK_METRO: MetroConfig = {
  id: "hk",
  name: "Hong Kong",
  shortName: "HK",
  marketLabel: "HK market",
  currency: "HKD",
  currencySymbol: "HK$",
  salaryPeriod: "monthly",
  locale: "en-HK",
  bandWidenFactor: 0.15,
  locationAliases: [
    "\\bhong ?kong\\b",
    "\\bhk\\b",
    "\\bkowloon\\b",
    "\\bnew territories\\b",
    "\\bhong kong island\\b",
    "香港",
  ],
  // Tech families (the beachhead) carry the densest point sets; non-tech
  // families are deliberately sparser stubs — the regression shrinks toward a
  // straight line when points are few, so sparse families still produce sane,
  // humble bands.
  roleFamilies: [
    {
      family: "data_scientist",
      label: "data science / ML roles",
      aliases: [
        "\\bdata scien",
        "\\bmachine learning",
        "\\bml engineer",
        "\\bai engineer",
        "\\bdeep learning",
      ],
      source: GUIDE_SOURCE,
      points: [
        { years: 0, p25: 24000, p50: 28000, p75: 33000 },
        { years: 3, p25: 34000, p50: 42000, p75: 50000 },
        { years: 6, p25: 45000, p50: 58000, p75: 72000 },
        { years: 10, p25: 60000, p50: 75000, p75: 95000 },
      ],
    },
    {
      family: "data_analyst",
      label: "data / business analyst roles",
      aliases: ["\\bdata analy", "\\bbusiness analy", "\\bbi analyst", "\\banalytics"],
      source: GUIDE_SOURCE,
      points: [
        { years: 0, p25: 17000, p50: 20000, p75: 24000 },
        { years: 2, p25: 22000, p50: 27000, p75: 32000 },
        { years: 4, p25: 28000, p50: 34000, p75: 42000 },
        { years: 7, p25: 36000, p50: 45000, p75: 56000 },
        { years: 10, p25: 42000, p50: 53000, p75: 68000 },
      ],
    },
    {
      family: "product_manager",
      label: "product management roles",
      aliases: ["\\bproduct manager\\b", "\\bproduct owner\\b", "\\bproduct lead\\b"],
      source: GUIDE_SOURCE,
      points: [
        { years: 2, p25: 30000, p50: 38000, p75: 46000 },
        { years: 5, p25: 45000, p50: 55000, p75: 68000 },
        { years: 9, p25: 60000, p50: 75000, p75: 95000 },
      ],
    },
    {
      family: "customer_service",
      label: "customer service roles",
      aliases: [
        "\\bcustomer service\\b",
        "\\bcustomer support\\b",
        "\\bcustomer success\\b",
        "\\bcall centre\\b",
        "\\bcall center\\b",
        "\\bhelpdesk\\b",
        "\\bhelp desk\\b",
      ],
      source: GUIDE_SOURCE,
      points: [
        { years: 0, p25: 13000, p50: 15000, p75: 18000 },
        { years: 3, p25: 17000, p50: 20000, p75: 24000 },
        { years: 7, p25: 22000, p50: 27000, p75: 33000 },
      ],
    },
    {
      family: "designer",
      label: "design / UX roles",
      aliases: ["\\bdesign", "\\bux", "\\bui\\b", "\\bcreative director", "\\billustrat"],
      source: GUIDE_SOURCE,
      points: [
        { years: 0, p25: 18000, p50: 22000, p75: 26000 },
        { years: 3, p25: 26000, p50: 32000, p75: 40000 },
        { years: 6, p25: 35000, p50: 45000, p75: 55000 },
        { years: 10, p25: 45000, p50: 58000, p75: 72000 },
      ],
    },
    {
      family: "marketing",
      label: "marketing roles",
      aliases: [
        "\\bmarketing\\b",
        "\\bseo\\b",
        "\\bsem\\b",
        "\\bgrowth\\b",
        "\\bbrand\\b",
        "\\bcontent\\b",
        "\\bsocial media\\b",
        "\\bcommunications\\b",
        "\\bpublic relations\\b",
      ],
      source: GUIDE_SOURCE,
      points: [
        { years: 0, p25: 15000, p50: 18000, p75: 22000 },
        { years: 3, p25: 22000, p50: 28000, p75: 34000 },
        { years: 6, p25: 32000, p50: 40000, p75: 50000 },
        { years: 10, p25: 42000, p50: 55000, p75: 70000 },
      ],
    },
    {
      family: "sales",
      label: "sales / business development roles (base salary, excl. commission)",
      aliases: [
        "\\bsales\\b",
        "\\bbusiness development\\b",
        "\\baccount executive\\b",
        "\\baccount manager\\b",
        "\\bbd manager\\b",
      ],
      source: GUIDE_SOURCE,
      points: [
        { years: 0, p25: 14000, p50: 17000, p75: 21000 },
        { years: 3, p25: 20000, p50: 26000, p75: 33000 },
        { years: 6, p25: 28000, p50: 38000, p75: 50000 },
        { years: 10, p25: 38000, p50: 50000, p75: 68000 },
      ],
    },
    {
      family: "finance",
      label: "finance / accounting roles",
      aliases: [
        "\\bfinance\\b",
        "\\bfinancial\\b",
        "\\baccountant\\b",
        "\\baccounting\\b",
        "\\bauditor\\b",
        "\\bbookkeep\\b",
        "\\btreasury\\b",
        "\\bfp&a\\b",
      ],
      source: GUIDE_SOURCE,
      points: [
        { years: 0, p25: 16000, p50: 19000, p75: 23000 },
        { years: 3, p25: 24000, p50: 30000, p75: 38000 },
        { years: 6, p25: 34000, p50: 43000, p75: 55000 },
        { years: 10, p25: 45000, p50: 58000, p75: 75000 },
      ],
    },
    {
      family: "hr",
      label: "HR / talent roles",
      aliases: [
        "\\bhuman resources\\b",
        "\\bhr\\b",
        "\\brecruit\\b",
        "\\btalent\\b",
        "\\bpeople ops\\b",
        "\\bpeople operations\\b",
        "\\bpeople partner\\b",
      ],
      source: GUIDE_SOURCE,
      points: [
        { years: 0, p25: 14000, p50: 17000, p75: 20000 },
        { years: 3, p25: 20000, p50: 25000, p75: 31000 },
        { years: 7, p25: 30000, p50: 38000, p75: 48000 },
      ],
    },
    {
      family: "admin",
      label: "admin / office support roles",
      aliases: [
        "\\badmin",
        "\\bassistant\\b",
        "\\bsecretary",
        "\\breceptionist",
        "\\bclerk\\b",
        "\\boffice manager",
      ],
      source: GUIDE_SOURCE,
      points: [
        { years: 0, p25: 13000, p50: 15000, p75: 18000 },
        { years: 3, p25: 16000, p50: 19000, p75: 23000 },
        { years: 7, p25: 20000, p50: 25000, p75: 31000 },
      ],
    },
    {
      family: "operations",
      label: "operations / project roles",
      aliases: [
        "\\boperations\\b",
        "\\blogistics\\b",
        "\\bsupply chain\\b",
        "\\bwarehouse\\b",
        "\\bprocurement\\b",
        "\\bproject manager\\b",
      ],
      source: GUIDE_SOURCE,
      points: [
        { years: 0, p25: 15000, p50: 18000, p75: 22000 },
        { years: 3, p25: 21000, p50: 26000, p75: 32000 },
        { years: 7, p25: 30000, p50: 38000, p75: 48000 },
      ],
    },
    {
      family: "software_engineer",
      label: "software engineering roles",
      aliases: [
        "\\bsoftware",
        "\\bdeveloper",
        "\\bprogrammer",
        "\\bengineer",
        "\\bdevops",
        "\\bsre\\b",
        "\\bfull[ -]?stack",
        "\\bfront[ -]?end",
        "\\bback[ -]?end",
        "\\bmobile",
        "\\bios\\b",
        "\\bandroid",
        "\\bqa\\b",
        "\\bweb dev",
      ],
      source: GUIDE_SOURCE,
      points: [
        { years: 0, p25: 20000, p50: 24000, p75: 28000 },
        { years: 2, p25: 26000, p50: 32000, p75: 38000 },
        { years: 4, p25: 34000, p50: 42000, p75: 52000 },
        { years: 6, p25: 42000, p50: 52000, p75: 65000 },
        { years: 9, p25: 52000, p50: 65000, p75: 82000 },
        { years: 12, p25: 60000, p50: 75000, p75: 95000 },
      ],
    },
  ],
};
