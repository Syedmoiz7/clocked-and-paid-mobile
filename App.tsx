import { AppBootstrap } from "./src/app/AppBootstrap";
import { AppProviders } from "./src/providers/AppProviders";
import { RootNavigator } from "./src/navigation/RootNavigator";

export default function App() {
  return (
    <AppProviders>
      <AppBootstrap>
        <RootNavigator />
      </AppBootstrap>
    </AppProviders>
  );
}
