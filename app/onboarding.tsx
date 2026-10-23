import { Redirect, router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import { OnboardingScreen } from "../src/screens/OnboardingScreen";
import {
  useAppDispatch,
  useAppSelector,
  useAppStore,
} from "../src/store/hooks";
import {
  advanceOnboarding,
  backOnboarding,
  clearOnboardingSuccess,
  finishOnboarding,
  saveOnboardingJob,
} from "../src/store/appSlice";
import {
  entryDestination,
  prepareOnboardingJob,
} from "../src/features/auth/model";

export default function OnboardingRoute() {
  const data = useAppSelector((state) => state.app),
    dispatch = useAppDispatch(),
    store = useAppStore();
  const params = useLocalSearchParams<{ review?: string }>();
  const review = params.review === "1";
  if (
    data.auth.session !== "mock" ||
    (data.auth.onboarding.complete && !review)
  )
    return <Redirect href={entryDestination(data)} />;
  return (
    <OnboardingScreen
      data={data}
      review={review}
      actions={{
        onName: (name) => dispatch(advanceOnboarding(name)),
        onBack: () => dispatch(backOnboarding()),
        onSaveJob: (draft) => {
          const current = store.getState().app;
          if (current.auth.onboarding.lastSavedJobId)
            return "This job is already saved. Choose Add another to create a different profile.";
          const id = Crypto.randomUUID();
          const result = prepareOnboardingJob(current, draft, id);
          if ("error" in result) return result.error;
          dispatch(saveOnboardingJob({ draft, id }));
          return store.getState().app.auth.onboarding.lastSavedJobId ===
            result.job.id
            ? null
            : "The workspace changed. Check your job limit and try again.";
        },
        onAnother: () => dispatch(clearOnboardingSuccess()),
        onFinish: (name) => {
          dispatch(finishOnboarding(name));
          router.replace(review ? "/settings" : "/tracker");
        },
        onPremium: () =>
          router.push({
            pathname: "/plans",
            params: {
              feature: "multipleJobs",
              returnTo: review ? "/onboarding?review=1" : "/onboarding",
            },
          }),
      }}
    />
  );
}
