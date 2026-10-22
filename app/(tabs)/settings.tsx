import { Alert } from "react-native";
import { SettingsScreen } from "../../src/screens/SettingsScreen";
import { useAppSelector } from "../../src/store/hooks";

export default function SettingsRoute() {
  const isPremium = useAppSelector((state) => state.app.isPremium);
  return <SettingsScreen isPremium={isPremium} onPremium={() => Alert.alert("Premium", "Plan management will be connected to billing later.")} />;
}
