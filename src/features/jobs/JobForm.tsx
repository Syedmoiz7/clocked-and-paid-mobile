import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import type { JobReminderSettings, MockJob } from "../../types";
import {
  Action,
  Choices,
  DateField,
  Field,
  Toggle,
} from "../../components/FormControls";
import { TimePickerField } from "../../components/TimePickerField";
import { useThemeTokens } from "../../providers/ThemeProvider";
import { localDate } from "../../utils/dateOnly";
import {
  currencies,
  jobColors,
  normalizeJob,
  reminderDefaults,
  schedulePreview,
  validateJob,
} from "./model";
import { CustomReminders } from "./CustomReminders";

export function JobForm({
  initial,
  busy,
  onSave,
  onCancel,
}: {
  initial: MockJob;
  busy: boolean;
  onSave: (job: MockJob) => void;
  onCancel: () => void;
}) {
  const { colors, styles } = useThemeTokens();
  const [draft, setDraft] = useState<MockJob>({
    ...initial,
    reminderSettings: initial.reminderSettings ?? reminderDefaults(),
  });
  const [numbers, setNumbers] = useState({
    hourlyRate: String(initial.hourlyRate),
    overtimeThreshold:
      initial.overtimeThreshold == null
        ? ""
        : String(initial.overtimeThreshold),
    overtimeMultiplier:
      initial.overtimeMultiplier == null
        ? ""
        : String(initial.overtimeMultiplier),
    lunchMinutes: String(initial.lunchMinutes ?? 30),
    lunchHours: String(initial.reminderSettings?.lunchHours ?? 5),
    repeatMinutes: String(initial.reminderSettings?.repeatMinutes ?? 10),
    snoozeMinutes: String(initial.reminderSettings?.snoozeMinutes ?? 10),
  });
  const [advanced, setAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = (changes: Partial<MockJob>) => {
    const scheduleChanged =
      "payFrequency" in changes ||
      "payPeriodStart" in changes ||
      "nextPayDate" in changes;
    setDraft((value) => ({
      ...value,
      ...(scheduleChanged ? { payDelayDays: undefined } : {}),
      ...changes,
    }));
    setError(null);
  };
  const settings = draft.reminderSettings!;
  const updateSettings = (changes: Partial<JobReminderSettings>) =>
    update({ reminderSettings: { ...settings, ...changes } });
  const numeric = (label: string, key: keyof typeof numbers) => (
    <Field
      label={label}
      numeric
      value={numbers[key]}
      onChange={(value) => {
        setNumbers((values) => ({ ...values, [key]: value }));
        setError(null);
      }}
    />
  );
  const preview = schedulePreview(draft, localDate(new Date()));
  const save = () => {
    const number = (key: keyof typeof numbers) =>
      numbers[key].trim() ? Number(numbers[key]) : NaN;
    const job: MockJob = {
      ...draft,
      hourlyRate: number("hourlyRate"),
      overtimeThreshold: numbers.overtimeThreshold.trim()
        ? number("overtimeThreshold")
        : undefined,
      overtimeMultiplier: numbers.overtimeMultiplier.trim()
        ? number("overtimeMultiplier")
        : undefined,
      lunchMinutes: number("lunchMinutes"),
      reminderSettings: {
        ...settings,
        lunchHours: number("lunchHours"),
        repeatMinutes: number("repeatMinutes"),
        snoozeMinutes: number("snoozeMinutes"),
      },
    };
    const error = validateJob(job);
    if (error) {
      setError(error);
      setAdvanced(true);
      return;
    }
    const changedSchedule =
      initial.payFrequency &&
      (initial.payFrequency !== job.payFrequency ||
        initial.payPeriodStart !== job.payPeriodStart);
    const commit = () => onSave(normalizeJob(job));
    if (changedSchedule)
      Alert.alert(
        "Change pay schedule?",
        "Generated period boundaries will change. Existing received paychecks and shift dates will not be rewritten.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Save changes", onPress: commit },
        ],
      );
    else commit();
  };
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>
        {initial.name ? "Edit job" : "Add job"}
      </Text>
      <Field
        label="Company / job name *"
        value={draft.name}
        onChange={(name) => update({ name })}
      />
      <Field
        label="Role / title"
        value={draft.title ?? ""}
        onChange={(title) => update({ title })}
      />
      <Field
        label="Notes"
        multiline
        value={draft.notes ?? ""}
        onChange={(notes) => update({ notes })}
      />
      {numeric("Hourly rate", "hourlyRate")}
      <Text style={styles.cardMeta}>Currency</Text>
      <Choices
        value={draft.currency ?? "USD"}
        options={currencies.map((value) => ({ value, label: value }))}
        onChange={(currency) => update({ currency })}
      />
      <Action
        title={advanced ? "Hide advanced settings ▴" : "Advanced settings ▾"}
        onPress={() => setAdvanced((value) => !value)}
      />
      {advanced && (
        <View>
          <Text style={[styles.cardTitle, { marginTop: 18 }]}>Overtime</Text>
          <Text style={styles.cardMeta}>
            Blank overrides use your saved Tracker defaults.
          </Text>
          {numeric("OT After (hrs)", "overtimeThreshold")}
          {numeric("OT Multiplier", "overtimeMultiplier")}
          <Text style={[styles.cardTitle, { marginTop: 18 }]}>
            Pay schedule
          </Text>
          <Choices
            value={draft.payFrequency ?? "none"}
            options={[
              { value: "none", label: "Not set" },
              { value: "weekly", label: "Weekly" },
              { value: "biweekly", label: "Biweekly" },
              { value: "semi-monthly", label: "Semi-monthly" },
              { value: "monthly", label: "Monthly" },
            ]}
            onChange={(value) =>
              update({
                payFrequency:
                  value === "none"
                    ? undefined
                    : (value as MockJob["payFrequency"]),
              })
            }
          />
          {draft.payFrequency && (
            <View>
              <DateField
                label="Anchor period start"
                value={draft.payPeriodStart ?? ""}
                onChange={(payPeriodStart) => update({ payPeriodStart })}
              />
              <Text style={styles.cardMeta}>
                Period end (auto):{" "}
                {normalizeJob(draft).payPeriodEnd ?? "Choose an anchor date"}
              </Text>
              <Text style={styles.cardMeta}>
                The anchor permanently determines past and future period
                boundaries.
              </Text>
              {preview.map((period) => (
                <Text
                  key={period.label}
                  style={[
                    styles.cardMeta,
                    period.label === "Current" && { color: colors.accent },
                  ]}
                >
                  {period.label}: {period.start} – {period.end}
                </Text>
              ))}
              <DateField
                label="Next pay date (optional)"
                value={draft.nextPayDate ?? ""}
                onChange={(nextPayDate) => update({ nextPayDate })}
              />
              {draft.nextPayDate && (
                <Action
                  title="Clear next pay date"
                  onPress={() => update({ nextPayDate: undefined })}
                />
              )}
            </View>
          )}
          <Text style={[styles.cardTitle, { marginTop: 18 }]}>
            Workday Defaults
          </Text>
          {numeric("Typical lunch break (min)", "lunchMinutes")}
          <Toggle
            title="Include lunch break by default"
            value={draft.lunchEnabled ?? true}
            onChange={(lunchEnabled) => update({ lunchEnabled })}
          />
          <Text style={[styles.cardTitle, { marginTop: 18 }]}>Reminders</Text>
          <Text style={styles.cardMeta}>Lunch break reminder</Text>
          <Choices
            value={settings.lunchMode}
            options={[
              { value: "off", label: "Off" },
              { value: "relative", label: "After hours" },
              { value: "fixed", label: "Fixed time" },
            ]}
            onChange={(value) =>
              updateSettings({
                lunchMode: value as JobReminderSettings["lunchMode"],
              })
            }
          />
          {settings.lunchMode === "relative" &&
            numeric("Hours after clock-in", "lunchHours")}
          {settings.lunchMode === "fixed" && (
            <TimePickerField
              label="Remind me at"
              value={settings.lunchTime}
              onChange={(lunchTime) => updateSettings({ lunchTime })}
            />
          )}
          <Toggle
            title="Remind me when lunch ends"
            value={settings.returnReminder}
            onChange={(returnReminder) => updateSettings({ returnReminder })}
          />
          {numeric("Re-fire after (min; 0 = no repeat)", "repeatMinutes")}
          <Toggle
            title="Sound alert"
            value={settings.sound}
            onChange={(sound) => updateSettings({ sound })}
          />
          <Toggle
            title="In-app alert indicator (mobile tab flash)"
            value={settings.indicator}
            onChange={(indicator) => updateSettings({ indicator })}
          />
          <Toggle
            title="Full-screen reminder overlay"
            value={settings.overlay}
            onChange={(overlay) => updateSettings({ overlay })}
          />
          {settings.overlay &&
            numeric("Default snooze (minutes)", "snoozeMinutes")}
          <CustomReminders
            value={settings.custom}
            onChange={(custom) => updateSettings({ custom })}
          />
          <Toggle
            title="Enable tips at clock-out"
            value={draft.enableTips ?? false}
            onChange={(enableTips) => update({ enableTips })}
          />
        </View>
      )}
      <Text style={[styles.cardMeta, { marginTop: 16 }]}>Label color</Text>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 12,
          marginTop: 10,
        }}
      >
        {jobColors.map((color) => (
          <Pressable
            key={color}
            accessibilityRole="button"
            accessibilityLabel={`Label color ${color}`}
            accessibilityState={{ selected: draft.color === color }}
            onPress={() => update({ color })}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              borderWidth: 2,
              borderColor: draft.color === color ? colors.text : "transparent",
              backgroundColor: color,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#fff" }}>
              {draft.color === color ? "✓" : ""}
            </Text>
          </Pressable>
        ))}
      </View>
      <Toggle
        title="Set as active / default job"
        value={draft.isDefault ?? false}
        onChange={(isDefault) => {
          if (initial.isDefault && !isDefault)
            Alert.alert(
              "Active job",
              "Set another job active to replace this default.",
            );
          else if (busy && isDefault !== initial.isDefault)
            Alert.alert(
              "Shift in progress",
              "Clock out before changing the active job.",
            );
          else update({ isDefault });
        }}
      />
      {busy && (
        <Text style={styles.cardMeta}>
          Changes apply to the next shift. The current Tracker plan stays
          unchanged.
        </Text>
      )}
      {error && (
        <Text
          accessibilityRole="alert"
          style={{ color: colors.danger, marginTop: 12 }}
        >
          {error}
        </Text>
      )}
      <Action title="Save job" onPress={save} />
      <Action title="Cancel" onPress={onCancel} />
    </View>
  );
}
