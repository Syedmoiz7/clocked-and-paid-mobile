import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeTokens } from "../providers/ThemeProvider";
import { useAppDispatch } from "../store/hooks";
import { setMockAccount } from "../store/appSlice";

export function AuthScreen() {
  const { colors, styles } = useThemeTokens();
  const dispatch = useAppDispatch();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleCredentials = () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(
        "Enter mock credentials",
        "Use any non-empty email and password for this UI-only build.",
      );
      return;
    }

    dispatch(
      setMockAccount({
        mode: "mock",
        name: email.trim().split("@")[0] || "Mock user",
        email: email.trim(),
      }),
    );
    router.replace("/tracker");
  };

  return (
    <SafeAreaView style={[styles.screen, { padding: 20 }]}>
      <View style={{ flex: 1, justifyContent: "center" }}>
        <Text style={styles.eyebrow}>Clocked & Paid</Text>
        <Text style={styles.title}>Your time, paid clearly.</Text>
        <Text style={styles.subtitle}>
          Track shifts, understand your pay, and keep your work history close.
        </Text>

        <View style={styles.card}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["sign-in", "sign-up"] as const).map((option) => (
              <Pressable
                key={option}
                onPress={() => setMode(option)}
                style={{
                  backgroundColor:
                    mode === option ? colors.accentSoft : "transparent",
                  borderColor: mode === option ? colors.accent : colors.border,
                  borderRadius: 12,
                  borderWidth: 1,
                  flex: 1,
                  padding: 12,
                }}
              >
                <Text
                  style={{
                    color: mode === option ? colors.accent : colors.muted,
                    fontWeight: "700",
                    textAlign: "center",
                  }}
                >
                  {option === "sign-in" ? "Sign in" : "Create account"}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.cardMeta, { marginTop: 18 }]}>
            Email address
          </Text>
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.muted}
            style={{
              borderColor: colors.border,
              borderRadius: 12,
              borderWidth: 1,
              color: colors.text,
              marginTop: 8,
              padding: 14,
            }}
            value={email}
          />
          <Text style={[styles.cardMeta, { marginTop: 14 }]}>Password</Text>
          <TextInput
            onChangeText={setPassword}
            placeholder="Any mock password"
            placeholderTextColor={colors.muted}
            secureTextEntry
            style={{
              borderColor: colors.border,
              borderRadius: 12,
              borderWidth: 1,
              color: colors.text,
              marginTop: 8,
              padding: 14,
            }}
            value={password}
          />
          <Pressable
            onPress={handleCredentials}
            style={[styles.button, { marginTop: 14 }]}
          >
            <Text style={styles.buttonText}>
              {mode === "sign-in" ? "Sign in" : "Create account"}
            </Text>
          </Pressable>
          <Text
            style={[styles.cardMeta, { marginTop: 12, textAlign: "center" }]}
          >
            Mock authentication for the UI phase. Backend authentication will
            replace this later.
          </Text>
        </View>

        <Pressable
          onPress={() => {
            dispatch(setMockAccount({ mode: "guest", name: "", email: "" }));
            router.replace("/tracker");
          }}
          style={[styles.secondaryButton, { marginTop: 14 }]}
        >
          <Text style={styles.secondaryButtonText}>Continue as guest</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
