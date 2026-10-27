import { Stack } from "expo-router";
import { AppBootstrap } from "../src/bootstrap/AppBootstrap";
import { AppProviders } from "../src/providers/AppProviders";
import * as SplashScreen from "expo-splash-screen";

// Hold the native launch screen until saved data (or its recovery UI) is ready.
void SplashScreen.preventAutoHideAsync().catch((error) =>
  console.warn("Could not retain the launch screen", error),
);

export default function RootLayout() {
  return (
    <AppProviders>
      <AppBootstrap>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "fade",
          }}
        />
      </AppBootstrap>
    </AppProviders>
  );
}
