import type { AppState } from "../types";

export type Entitlements = {
  source: "mock";
  plan: "free" | "premium";
  jobLimit: number;
  multipleSimultaneousJobs: boolean;
  deductionsManager: boolean;
  backupRestore: boolean;
  recoveryTools: boolean;
  fullThemePalette: boolean;
};
// Backend subscription data will replace this adapter; local preview is not billing verification.
export function entitlementsFor(
  data: Pick<AppState, "isPremium">,
): Entitlements {
  return {
    source: "mock",
    plan: data.isPremium ? "premium" : "free",
    jobLimit: data.isPremium ? Infinity : 1,
    multipleSimultaneousJobs: data.isPremium,
    deductionsManager: data.isPremium,
    backupRestore: data.isPremium,
    recoveryTools: data.isPremium,
    fullThemePalette: data.isPremium,
  };
}
