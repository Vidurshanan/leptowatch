/** Documented staging facts from notebooks 38–40. Not live operational values. */
export const APP_NAME = "LeptoWatch";
export const APP_TAGLINE = "Sri Lanka leptospirosis surveillance";

export const STAGING = {
  mode: "STAGING_DEMONSTRATION_NOT_OPERATIONAL",
  decision: "FINAL_STAGING_DEMONSTRATION_REPRODUCIBLE_NOT_OPERATIONAL",
  operationalApproval: false,
  lockedTestEvaluated: false,
  rdhsCount: 26,
  issueStart: "2026-11-02",
  latestAcceptedCaseWeek: "2026-08-10",
  freshnessLimitDays: 56,
  // Note: Case freshness age is calculated dynamically by the backend API, not hardcoded.
  watchCount: 26,
  unverifiedCount: 26,
} as const;

export const STAGING_BANNER =
  "Staging demonstration — not approved for operational public-health use. Watch + UNVERIFIED means freshness or verification requirements were not met; it is not evidence of elevated disease activity.";
