import { Alert } from "react-native";
import { HistoryScreen } from "../../src/screens/HistoryScreen";
import { useAppSelector } from "../../src/store/hooks";

export default function HistoryRoute() {
  const history = useAppSelector((state) => state.app.history);
  return <HistoryScreen history={history} onPremium={() => Alert.alert("Premium", "Advanced history will be connected to entitlements later.")} />;
}
