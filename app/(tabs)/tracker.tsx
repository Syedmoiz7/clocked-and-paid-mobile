import { Alert } from "react-native";
import { TrackerRoute } from "../../src/navigation/TrackerRoute";

export default function TrackerTabRoute() {
  return <TrackerRoute onPremium={() => Alert.alert("Premium", "Premium features will be connected to billing later.")} />;
}
