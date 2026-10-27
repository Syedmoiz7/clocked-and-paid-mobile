import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Action } from "../src/components/FormControls";
import { PrimaryAction } from "../src/features/auth/Controls";
import { entryDestination, safePlanReturn } from "../src/features/auth/model";
import {
  entitlementsFor,
  featureNames,
  type UpgradeFeature,
} from "../src/services/entitlements";
import { useThemeTokens } from "../src/providers/ThemeProvider";
import { useAppDispatch, useAppSelector } from "../src/store/hooks";
import { enterGuest, setPremiumPreview } from "../src/store/appSlice";
import { PlanCards } from "../src/features/auth/PlanCards";
export default function PlansRoute() {
  const { styles } = useThemeTokens();
  const data = useAppSelector((state) => state.app),
    dispatch = useAppDispatch();
  const params = useLocalSearchParams<{
    feature?: string;
    returnTo?: string;
  }>();
  const returnTo = safePlanReturn(params.returnTo);
  const feature =
    params.feature &&
    Object.prototype.hasOwnProperty.call(featureNames, params.feature)
      ? featureNames[params.feature as UpgradeFeature]
      : null;
  const features = entitlementsFor(data);
  const close = () => {
    if (router.canGoBack()) router.back();
    else
      router.replace(
        data.auth.session === "signed-out"
          ? "/auth"
          : entryDestination(data) === "/onboarding"
            ? "/onboarding"
            : returnTo,
      );
  };
  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>PLANS · LOCAL DEMO</Text>
        <Text style={styles.title}>Free & Premium</Text>
        <Text style={styles.subtitle}>
          {feature
            ? `${feature} is part of Premium.`
            : "Choose the experience you want to preview."}
        </Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Current:{" "}
            {features.plan === "premium" ? "Mock Premium preview" : "Free"}
          </Text>
          <Text style={styles.cardMeta}>
            Pricing is not finalized. No trial, subscription, payment or
            app-store purchase is created by these controls.
          </Text>
        </View>
        <PlanCards />
        {data.isPremium ? (
          <PrimaryAction
            title="End Premium preview & use Free"
            onPress={() => {
              dispatch(setPremiumPreview(false));
              close();
            }}
          />
        ) : (
          <PrimaryAction
            title={
              data.auth.session === "signed-out"
                ? "Start Premium preview as guest"
                : "Start Premium preview (no charge)"
            }
            onPress={() => {
              dispatch(setPremiumPreview(true));
              if (data.auth.session === "signed-out") {
                dispatch(enterGuest());
                router.replace("/tracker");
              } else close();
            }}
          />
        )}
        <Text style={styles.cardMeta}>
          Ending preview keeps all records, profiles and running shifts.
          Premium-only actions lock again; existing data is not deleted or
          downgraded.
        </Text>
        <Action
          title={data.isPremium ? "Back to app" : "Continue with Free"}
          onPress={close}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
