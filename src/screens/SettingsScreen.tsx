import { useEffect, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useThemeTokens } from "../providers/ThemeProvider";
import { SafeAreaView } from "react-native-safe-area-context";
import { Action, Choices } from "../components/FormControls";
import type { AppState, MockAccount } from "../types";
import { AccountCard } from "../features/settings/AccountCard";
import {
  AppearanceCard,
  PayPreview,
  PreferenceCards,
} from "../features/settings/PreferenceCards";
import { DataCards, type DataActions } from "../features/settings/DataCards";
import { PrivacyCard } from "../features/settings/PrivacyCard";
import {
  settingsDraft,
  validateSettings,
  type SettingsDraft,
} from "../features/settings/model";

export type SettingsActions = DataActions & {
  onSave: (draft: SettingsDraft) => void;
  onHue: (hue: number) => void;
  onAccount: (account: MockAccount) => void;
  onPassword: (password: string) => Promise<void>;
  onSignIn: () => void;
  onSignOut: () => void;
  onSetup: () => void;
  onPremium: () => void;
  onEndPreview: () => void;
};
export function SettingsScreen({
  data,
  actions,
}: {
  data: AppState;
  actions: SettingsActions;
}) {
  const { colors, styles } = useThemeTokens();
  const [tab, setTab] = useState("account"),
    [draft, setDraft] = useState(() => settingsDraft(data));
  const source = JSON.stringify(settingsDraft(data)),
    previous = useRef(source);
  const [error, setError] = useState(""),
    [feedback, setFeedback] = useState("");
  useEffect(() => {
    const old = previous.current;
    previous.current = source;
    setDraft((value) =>
      JSON.stringify(value) === old
        ? settingsDraft(data)
        : {
            ...value,
            preferences: {
              ...value.preferences,
              themeHue: data.preferences.themeHue,
            },
          },
    );
  }, [source]);
  const dirty = JSON.stringify(draft) !== source;
  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <Text style={styles.eyebrow}>PERSONALIZE</Text>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>
          Manage your account, appearance, and app preferences.
        </Text>
        <Choices
          value={tab}
          options={[
            { value: "account", label: "Account" },
            { value: "app", label: "App" },
          ]}
          onChange={setTab}
        />
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {data.isPremium ? "Mock Premium preview" : "Free plan"}
          </Text>
          <Text style={styles.cardMeta}>
            Local demo entitlement only. No subscription or charge is created.
          </Text>
          <Action
            title={data.isPremium ? "End Premium preview" : "Explore Premium"}
            onPress={data.isPremium ? actions.onEndPreview : actions.onPremium}
          />
        </View>
        {tab === "account" ? (
          <AccountCard
            account={data.account}
            onAccount={actions.onAccount}
            onPassword={actions.onPassword}
            onSignIn={actions.onSignIn}
            onSignOut={actions.onSignOut}
            onSetup={actions.onSetup}
          />
        ) : (
          <>
            <PreferenceCards
              draft={draft}
              onChange={(value) => {
                setDraft(value);
                setError("");
                setFeedback("");
              }}
            />
            <AppearanceCard
              data={data}
              onHue={actions.onHue}
              onPremium={actions.onPremium}
            />
            <PrivacyCard />
            <DataCards
              data={data}
              actions={{
                ...actions,
                onReset: async () => {
                  const reset = await actions.onReset();
                  setDraft(reset);
                  setError("");
                  setFeedback("");
                  return reset;
                },
                onImport: async (imported, mode, includeSettings) => {
                  await actions.onImport(imported, mode, includeSettings);
                  if (includeSettings && imported.settings) {
                    setDraft(imported.settings);
                    setError("");
                    setFeedback("");
                  }
                },
              }}
              onPremium={actions.onPremium}
            />
            <PayPreview data={data} draft={draft} />
            <View style={styles.card}>
              <Text style={styles.cardTitle}>About Clocked & Paid</Text>
              <Text style={styles.cardMeta}>
                Local-first mobile preview · 0.1.0. Financial figures are
                estimates, not payroll/tax advice. Cloud authentication,
                synchronization and billing are not connected.
              </Text>
            </View>
          </>
        )}
        {feedback !== "" && (
          <Text
            accessibilityRole="alert"
            style={{ color: colors.success, marginTop: 12 }}
          >
            {feedback}
          </Text>
        )}
        {error !== "" && (
          <Text
            accessibilityRole="alert"
            style={{ color: colors.danger, marginTop: 12 }}
          >
            {error}
          </Text>
        )}
      </ScrollView>
      {dirty && tab === "app" && (
        <View
          style={{
            backgroundColor: colors.surfaceRaised,
            borderTopColor: colors.accent,
            borderTopWidth: 1,
            padding: 12,
          }}
        >
          <Text style={styles.cardMeta}>Unsaved changes</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Action
                title="Discard"
                onPress={() => {
                  setDraft(settingsDraft(data));
                  setError("");
                  setFeedback("Changes discarded.");
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Action
                title="Save Changes"
                onPress={() => {
                  const error = validateSettings(draft);
                  if (error) {
                    setError(error);
                    return;
                  }
                  actions.onSave(draft);
                  setError("");
                  setFeedback("Preferences saved on this device.");
                }}
              />
            </View>
          </View>
          {error !== "" && (
            <Text accessibilityRole="alert" style={{ color: colors.danger }}>
              {error}
            </Text>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}
