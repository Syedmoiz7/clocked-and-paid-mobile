import { Alert } from "react-native";
import { TrackerRoute } from "../../src/navigation/TrackerRoute";
import { useAppDispatch } from "../../src/store/hooks";
import { setPremiumPreview } from "../../src/store/appSlice";

export default function TrackerTabRoute() {
  const dispatch = useAppDispatch();
  return (
    <TrackerRoute
      onPremium={() =>
        Alert.alert(
          "Preview Premium",
          "Enable local mock Premium entitlements. No purchase or charge is made.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Start preview",
              onPress: () => dispatch(setPremiumPreview(true)),
            },
          ],
        )
      }
    />
  );
}
