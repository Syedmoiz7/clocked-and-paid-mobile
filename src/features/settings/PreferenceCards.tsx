import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Action, Choices, Field, Toggle } from "../../components/FormControls";
import { TimePickerField } from "../../components/TimePickerField";
import { useThemeTokens } from "../../providers/ThemeProvider";
import { themedColors } from "../../theme";
import type { AppState } from "../../types";
import { money } from "../history/model";
import { themeOptions, typicalShift, type SettingsDraft } from "./model";
import { entitlementsFor } from "../../services/entitlements";

export function SettingsNumber({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState(Number.isFinite(value) ? String(value) : "");
  useEffect(() => {
    if (Number.isFinite(value) && Number(text) !== value)
      setText(String(value));
  }, [value]);
  return (
    <Field
      label={label}
      numeric
      value={text}
      onChange={(text) => {
        setText(text);
        onChange(text.trim() ? Number(text) : NaN);
      }}
    />
  );
}
export function PreferenceCards({
  draft,
  onChange,
}: {
  draft: SettingsDraft;
  onChange: (value: SettingsDraft) => void;
}) {
  const { styles } = useThemeTokens();
  const prefs = draft.preferences,
    plan = draft.plan,
    reminders = prefs.defaultReminders;
  const [customHours, setCustomHours] = useState(
    ![6, 8, 10, 12].includes(plan.plannedHours),
  );
  const update = (changes: Partial<typeof prefs>) =>
    onChange({ ...draft, preferences: { ...prefs, ...changes } });
  const updatePlan = (changes: Partial<typeof plan>) =>
    onChange({ ...draft, plan: { ...plan, ...changes } });
  const reminder = (changes: Partial<typeof reminders>) =>
    update({ defaultReminders: { ...reminders, ...changes } });
  return (
    <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Workday Defaults</Text>
        <Text style={styles.cardMeta}>
          Used for planning and calculators. Job-specific rules take priority. A
          running shift's plan is not reset.
        </Text>
        <Choices
          value={
            !customHours && [6, 8, 10, 12].includes(plan.plannedHours)
              ? String(plan.plannedHours)
              : "custom"
          }
          options={[6, 8, 10, 12]
            .map((value) => ({ value: String(value), label: `${value} hrs` }))
            .concat([{ value: "custom", label: "Custom" }])}
          onChange={(value) => {
            setCustomHours(value === "custom");
            if (value !== "custom") updatePlan({ plannedHours: Number(value) });
          }}
        />
        {(customHours || ![6, 8, 10, 12].includes(plan.plannedHours)) && (
          <SettingsNumber
            label="Typical work hours (up to 24)"
            value={plan.plannedHours}
            onChange={(plannedHours) => updatePlan({ plannedHours })}
          />
        )}
        <Toggle
          title="Include lunch by default"
          value={plan.lunchEnabled}
          onChange={(lunchEnabled) => updatePlan({ lunchEnabled })}
        />
        <SettingsNumber
          label="Default lunch duration (min)"
          value={plan.lunchMinutes}
          onChange={(lunchMinutes) => updatePlan({ lunchMinutes })}
        />
        <TimePickerField
          label="Typical start time (reference only)"
          value={prefs.typicalStartTime}
          onChange={(typicalStartTime) => update({ typicalStartTime })}
        />
        {prefs.typicalStartTime !== "" && (
          <Action
            title="Clear typical start time"
            onPress={() => update({ typicalStartTime: "" })}
          />
        )}
        <Text style={styles.cardMeta}>{typicalShift(draft)}</Text>
        <Toggle
          title="Include break in time remaining"
          value={draft.breakIncluded}
          onChange={(breakIncluded) => onChange({ ...draft, breakIncluded })}
        />
        <Text style={[styles.cardTitle, { marginTop: 18 }]}>
          Default Reminders
        </Text>
        <Text style={styles.cardMeta}>
          Used only when a job has no custom reminder settings. Edit
          job-specific rules in Jobs.
        </Text>
        <Toggle
          title="Lunch Start Reminder"
          value={reminders.lunchMode !== "off"}
          onChange={(enabled) =>
            reminder({ lunchMode: enabled ? "relative" : "off" })
          }
        />
        {reminders.lunchMode !== "off" && (
          <SettingsNumber
            label="Remind after (hours worked)"
            value={reminders.lunchHours}
            onChange={(lunchHours) => reminder({ lunchHours })}
          />
        )}
        <Toggle
          title="Return-to-Work Reminder"
          value={reminders.returnReminder}
          onChange={(returnReminder) => reminder({ returnReminder })}
        />
        <SettingsNumber
          label="Re-fire interval (min; 0 = off)"
          value={reminders.repeatMinutes}
          onChange={(repeatMinutes) => reminder({ repeatMinutes })}
        />
        <SettingsNumber
          label="Snooze duration (min)"
          value={reminders.snoozeMinutes}
          onChange={(snoozeMinutes) => reminder({ snoozeMinutes })}
        />
        <Toggle
          title="Reminder sound"
          value={reminders.sound}
          onChange={(sound) => reminder({ sound })}
        />
        <Toggle
          title="Reminder overlay"
          value={reminders.overlay}
          onChange={(overlay) => reminder({ overlay })}
        />
        <Toggle
          title="Reminder indicator"
          value={reminders.indicator}
          onChange={(indicator) => reminder({ indicator })}
        />
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Preferences</Text>
        <Toggle
          title="Manual Time Editing"
          value={prefs.enableManualEditing}
          onChange={(enableManualEditing) => update({ enableManualEditing })}
        />
        <Toggle
          title="Daily Motivational Quote"
          value={prefs.showDailyQuote}
          onChange={(showDailyQuote) => update({ showDailyQuote })}
        />
        <Toggle
          title="Allow concurrent jobs (Premium)"
          value={prefs.allowConcurrentShifts}
          onChange={(allowConcurrentShifts) =>
            update({ allowConcurrentShifts })
          }
        />
        <Toggle
          title="Hide pay by default"
          value={prefs.payHiddenByDefault}
          onChange={(payHiddenByDefault) => update({ payHiddenByDefault })}
        />
        <Text style={styles.cardMeta}>
          Clock Format · applies across the app
        </Text>
        <Choices
          value={prefs.clockFormat}
          options={[
            { value: "12h", label: "12-Hour · 9:30 AM" },
            { value: "24h", label: "24-Hour · 09:30" },
          ]}
          onChange={(value) =>
            update({ clockFormat: value as typeof prefs.clockFormat })
          }
        />
        <Text style={styles.cardMeta}>Shift Timer Direction</Text>
        <Choices
          value={plan.timerDirection}
          options={[
            { value: "count-up", label: "Count Up" },
            { value: "count-down", label: "Count Down" },
          ]}
          onChange={(value) =>
            updatePlan({ timerDirection: value as typeof plan.timerDirection })
          }
        />
        <Text style={styles.cardMeta}>
          Tab timer label · mobile equivalent of Browser Tab Time
        </Text>
        <Choices
          value={prefs.headerTimerMode}
          options={[
            { value: "count-up", label: "Count Up" },
            { value: "count-down", label: "Count Down" },
            { value: "off", label: "Off" },
          ]}
          onChange={(value) =>
            update({ headerTimerMode: value as typeof prefs.headerTimerMode })
          }
        />
      </View>
    </>
  );
}
export function AppearanceCard({
  data,
  onHue,
  onPremium,
}: {
  data: AppState;
  onHue: (hue: number) => void;
  onPremium: () => void;
}) {
  const { colors, styles } = useThemeTokens();
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>App Theme Color</Text>
      <Text style={styles.cardMeta}>
        Saved automatically. Full palette uses mock Premium.
      </Text>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 12,
          marginTop: 14,
        }}
      >
        {themeOptions.map((option, index) => (
          <Pressable
            key={option.hue}
            accessibilityRole="button"
            accessibilityLabel={`${option.label}${index > 0 && !entitlementsFor(data).fullThemePalette ? ", Premium" : ""}`}
            accessibilityState={{
              selected: data.preferences.themeHue === option.hue,
            }}
            onPress={() => {
              if (index > 0 && !entitlementsFor(data).fullThemePalette)
                onPremium();
              else onHue(option.hue);
            }}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: themedColors(option.hue).accent,
              borderWidth: 2,
              borderColor:
                data.preferences.themeHue === option.hue
                  ? colors.text
                  : "transparent",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff" }}>
              {data.preferences.themeHue === option.hue
                ? "✓"
                : index > 0 && !entitlementsFor(data).fullThemePalette
                  ? "◇"
                  : ""}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export function PayPreview({
  data,
  draft,
}: {
  data: AppState;
  draft: SettingsDraft;
}) {
  const { styles } = useThemeTokens();
  if (!Number.isFinite(draft.plan.plannedHours) || draft.plan.plannedHours <= 0)
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Pay Preview</Text>
        <Text style={styles.cardMeta}>
          Enter valid work hours to preview pay.
        </Text>
      </View>
    );
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Pay Preview</Text>
      <Text style={styles.cardMeta}>
        Illustrative base-rate day, matching the client's preview; overtime is
        shown separately.
      </Text>
      {[
        ...data.jobs
          .filter((item) => !item.archived)
          .map((job) => ({
            name: job.name,
            rate: job.hourlyRate,
            multiplier: job.overtimeMultiplier ?? draft.plan.overtimeMultiplier,
            currency: job.currency ?? draft.preferences.currency,
          })),
        {
          name: "Global / Unlabeled shifts",
          rate: draft.plan.hourlyRate,
          multiplier: draft.plan.overtimeMultiplier,
          currency: draft.preferences.currency,
        },
      ].map((row) => (
        <View key={row.name} style={{ marginTop: 14 }}>
          <Text style={styles.cardTitle}>{row.name}</Text>
          <Text style={styles.cardMeta}>
            {data.payVisible
              ? `Regular / hr: ${money(row.rate, row.currency)} · OT / hr: ${money(row.rate * row.multiplier, row.currency)} · ${draft.plan.plannedHours}hr day: ${money(row.rate * draft.plan.plannedHours, row.currency)}`
              : "••••• · pay is hidden"}
          </Text>
        </View>
      ))}
    </View>
  );
}
