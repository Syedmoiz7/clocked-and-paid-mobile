import { Text, View } from "react-native";
import { colors } from "../theme";

export function AppLoading() {
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: colors.background,
        flex: 1,
        justifyContent: "center",
      }}
    >
      <Text style={{ color: colors.muted }}>Loading Clocked & Paid…</Text>
    </View>
  );
}
