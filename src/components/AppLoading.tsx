import { Text, View } from "react-native";
import { useThemeTokens } from "../providers/ThemeProvider";

export function AppLoading() {
  const { colors, styles } = useThemeTokens();
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
