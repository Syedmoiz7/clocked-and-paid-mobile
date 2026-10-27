import { ActivityIndicator, Image, Text, View } from "react-native";
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
      <Image
        source={require("../../assets/branding/splash-icon.png")}
        style={{ width: 200, height: 200 }}
        resizeMode="contain"
        accessible={false}
      />
      <ActivityIndicator color={colors.accent} style={{ marginTop: 16 }} />
      <Text style={{ color: colors.muted, marginTop: 12 }}>
        Loading Clocked & Paid…
      </Text>
    </View>
  );
}
