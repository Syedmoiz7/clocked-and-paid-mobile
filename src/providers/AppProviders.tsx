import type { PropsWithChildren } from "react";
import { Provider } from "react-redux";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { store } from "../store/store";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <Provider store={store}>
      <SafeAreaProvider>{children}</SafeAreaProvider>
    </Provider>
  );
}
