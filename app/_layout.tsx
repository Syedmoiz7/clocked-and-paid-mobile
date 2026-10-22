import { Stack } from "expo-router";
import { AppBootstrap } from "../src/bootstrap/AppBootstrap";
import { AppProviders } from "../src/providers/AppProviders";

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
