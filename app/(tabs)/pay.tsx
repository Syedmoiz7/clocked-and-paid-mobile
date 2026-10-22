import { Alert } from "react-native";
import { PayScreen } from "../../src/screens/PayScreen";

export default function PayRoute() {
  return <PayScreen onPremium={() => Alert.alert("Premium", "Advanced pay features will be connected to entitlements later.")} />;
}
