import { useState, type PropsWithChildren } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeTokens } from "../../providers/ThemeProvider";

export function AuthLayout({ children }: PropsWithChildren) {
  const { colors, styles } = useThemeTokens();
  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{
            flexGrow: 1,
            padding: 20,
            justifyContent: "center",
          }}
        >
          <View style={[styles.card, { marginTop: 0 }]}>
            <View style={{ alignItems: "center", marginBottom: 20 }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  backgroundColor: colors.accent,
                  borderRadius: 16,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{ color: "#fff", fontWeight: "900", fontSize: 18 }}
                >
                  C&P
                </Text>
              </View>
              <Text style={styles.title}>Clocked & Paid</Text>
              <Text style={styles.subtitle}>
                Your private time & pay tracker
              </Text>
            </View>
            <Text style={[styles.cardMeta, { marginBottom: 14 }]}>
              Local mock preview · use test values only. No real account, email
              or payment service is connected.
            </Text>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function AuthField({
  label,
  value,
  onChange,
  password = false,
  email = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  password?: boolean;
  email?: boolean;
}) {
  const { colors, styles } = useThemeTokens();
  const [shown, setShown] = useState(false);
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={styles.cardMeta}>{label}</Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 12,
          marginTop: 6,
          backgroundColor: colors.background,
        }}
      >
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChange}
          secureTextEntry={password && !shown}
          keyboardType={email ? "email-address" : "default"}
          autoCapitalize={password || email ? "none" : "words"}
          autoCorrect={!password && !email}
          autoComplete="off"
          style={{ color: colors.text, flex: 1, padding: 13, minHeight: 48 }}
        />
        {password && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${shown ? "Hide" : "Show"} ${label.toLowerCase()}`}
            onPress={() => setShown((value) => !value)}
            style={{ padding: 12 }}
          >
            <Text style={{ color: colors.accent }}>
              {shown ? "Hide" : "Show"}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
export function PrimaryAction({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { styles } = useThemeTokens();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, { marginTop: 18, opacity: disabled ? 0.5 : 1 }]}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </Pressable>
  );
}
export function FlowMessage({
  message,
  error = false,
}: {
  message: string;
  error?: boolean;
}) {
  const { colors } = useThemeTokens();
  return message ? (
    <Text
      accessibilityRole="alert"
      style={{
        color: error ? colors.danger : colors.success,
        marginTop: 14,
        lineHeight: 21,
      }}
    >
      {message}
    </Text>
  ) : null;
}
