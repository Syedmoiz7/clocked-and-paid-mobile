import { useEffect, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useThemeTokens } from "../providers/ThemeProvider";
import { SafeAreaView } from "react-native-safe-area-context";
import { Action, Choices } from "../components/FormControls";
import type { AppState, MockAccount } from "../types";
import { rebaseSettingsDraft, sameValue } from "../features/settings/drafts";
import { PayVisibilityButton } from "../components/PayVisibilityButton";
import { AccountCard } from "../features/settings/AccountCard";
import {
  AppearanceCard,
  PayPreview,
  PreferenceCards,
} from "../features/settings/PreferenceCards";
import { DataCards, type DataActions } from "../features/settings/DataCards";
import { PrivacyCard } from "../features/settings/PrivacyCard";
import { settingsDraft, type SettingsDraft } from "../features/settings/model";

export type SettingsActions = DataActions & {
  onSave: (
    draft: SettingsDraft,
    base: SettingsDraft,
  ) => Promise<
    { draft: SettingsDraft; error: null } | { error: string; draft?: never }
  >;
  onHue: (hue: number) => Promise<string | null>;
  onAccount: (
    account: Partial<Pick<MockAccount, "name" | "email">>,
  ) => Promise<string | null>;
  onPayVisibility: () => void;
  onPassword: (password: string) => Promise<void>;
  onSignIn: () => void;
  onSignOut: (hasDrafts: boolean) => void;
  onPremium: () => void;
  onEndPreview: () => void;
};
export function SettingsScreen({
  data,
  actions,
  busy,
}: {
  data: AppState;
  actions: SettingsActions;
  busy: boolean;
}) {
  const { colors, styles } = useThemeTokens();
  const [tab, setTab] = useState("account"),
    [draft, setDraft] = useState(() => settingsDraft(data));
  const source = settingsDraft(data),
    previous = useRef(source);
  const pending = useRef(false);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState(""),
    [feedback, setFeedback] = useState("");
  useEffect(() => {
    const old = previous.current;
    previous.current = source;
    setDraft((value) => rebaseSettingsDraft(value, old, source));
  }, [data.preferences, data.defaultPlan, data.breakIncludedInRemaining]);
  const dirty = !sameValue(draft, source);
  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <Text style={styles.eyebrow}>PERSONALIZE</Text>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Text style={[styles.title, { flexGrow: 1 }]}>Settings</Text>
          <PayVisibilityButton
            visible={data.payVisible}
            onToggle={actions.onPayVisibility}
          />
        </View>
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
          disabled={busy}
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
            disabled={busy}
          />
        </View>
        {tab === "account" ? (
          <AccountCard
            account={data.account}
            saving={busy}
            onAccount={actions.onAccount}
            onPassword={actions.onPassword}
            onSignIn={actions.onSignIn}
            onSignOut={(hasDrafts) => actions.onSignOut(dirty || hasDrafts)}
          />
        ) : (
          <>
            <PreferenceCards
              key={revision}
              draft={draft}
              disabled={busy}
              premium={data.isPremium}
              onPremium={actions.onPremium}
              onChange={(value) => {
                if (busy) return;
                setDraft(value);
                setError("");
                setFeedback("");
              }}
            />
            <AppearanceCard
              data={data}
              onHue={actions.onHue}
              busy={busy}
              onPremium={actions.onPremium}
            />
            <PrivacyCard />
            <DataCards
              data={data}
              blocked={busy}
              unsavedPreferences={dirty}
              actions={{
                ...actions,
                onReset: async () => {
                  const reset = await actions.onReset();
                  setDraft(reset);
                  setError("");
                  setFeedback("");
                  previous.current = reset;
                  setRevision((value) => value + 1);
                  return reset;
                },
                onImport: async (imported, mode, includeSettings) => {
                  if (dirty && includeSettings)
                    throw new Error(
                      "Save or discard App preferences before restoring preferences from a backup.",
                    );
                  const restored = await actions.onImport(
                    imported,
                    mode,
                    includeSettings,
                  );
                  if (includeSettings && imported.settings) {
                    setDraft(restored);
                    previous.current = restored;
                    setRevision((value) => value + 1);
                    setError("");
                    setFeedback("");
                  }
                  return restored;
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
        {error !== "" && !dirty && (
          <Text
            accessibilityRole="alert"
            style={{ color: colors.danger, marginTop: 12 }}
          >
            {error}
          </Text>
        )}
      </ScrollView>
      {dirty && (
        <View
          style={{
            backgroundColor: colors.surfaceRaised,
            borderTopColor: colors.accent,
            borderTopWidth: 1,
            padding: 12,
          }}
        >
          <Text style={styles.cardMeta}>Unsaved App preferences</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Action
                title="Discard"
                disabled={busy}
                onPress={() => {
                  setDraft(settingsDraft(data));
                  previous.current = settingsDraft(data);
                  setRevision((value) => value + 1);
                  setError("");
                  setFeedback("Changes discarded.");
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Action
                title={busy ? "Saving…" : "Save Changes"}
                disabled={busy}
                onPress={() => {
                  if (pending.current) return;
                  pending.current = true;
                  setError("");
                  setFeedback("");
                  void actions
                    .onSave(draft, previous.current)
                    .then((result) => {
                      if (result.error) setError(result.error);
                      else if (result.draft) {
                        setDraft(result.draft);
                        previous.current = result.draft;
                        setRevision((value) => value + 1);
                        setFeedback("Preferences saved on this device.");
                      }
                    })
                    .catch(() =>
                      setError(
                        "Could not save. Your draft is still here. Please try again.",
                      ),
                    )
                    .finally(() => {
                      pending.current = false;
                    });
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
