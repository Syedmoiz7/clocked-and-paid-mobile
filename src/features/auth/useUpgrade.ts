import { router } from "expo-router";
import type { UpgradeFeature } from "../../services/entitlements";
import { safePlanReturn } from "./model";
export function useUpgrade(
  feature: UpgradeFeature | undefined,
  returnTo: string,
) {
  return () =>
    router.push({
      pathname: "/plans",
      params: {
        ...(feature ? { feature } : {}),
        returnTo: safePlanReturn(returnTo),
      },
    });
}
