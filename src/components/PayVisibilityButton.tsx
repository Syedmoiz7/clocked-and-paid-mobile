import { Pressable, Text, View } from "react-native";
import { useThemeTokens } from "../providers/ThemeProvider";

export function PayVisibilityButton({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  const { colors } = useThemeTokens();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={visible ? "Hide pay" : "Show pay"}
      accessibilityHint="Changes pay visibility across the app"
      accessibilityValue={{ text: visible ? "Pay visible" : "Pay hidden" }}
      onPress={onToggle}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        minHeight: 44,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 22,
        backgroundColor: colors.accentSoft,
        opacity: pressed ? 0.65 : 1,
      })}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 20,
          height: 20,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: 18,
            height: 12,
            borderWidth: 1.5,
            borderColor: colors.accent,
            borderRadius: 10,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: 5,
              height: 5,
              borderRadius: 3,
              backgroundColor: colors.accent,
            }}
          />
        </View>
        {!visible && (
          <View
            style={{
              position: "absolute",
              width: 22,
              height: 1.5,
              backgroundColor: colors.accent,
              transform: [{ rotate: "-45deg" }],
            }}
          />
        )}
      </View>
      <Text
        style={{
          color: colors.accent,
          fontSize: 13,
          fontWeight: "700",
          flexShrink: 1,
        }}
      >
        {visible ? "Hide pay" : "Show pay"}
      </Text>
    </Pressable>
  );
}
