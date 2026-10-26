import { useRef, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import type { AppState, JobReminderSettings, MockJob } from "../../types";
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
import { addDays } from "../history/payPeriods";
import {
  currencies,
  jobColors,
  jobDraftNumbers,
  prepareJobDraft,
  jobInProgress,
  jobReferenced,
  workInProgress,
  jobScheduleChanged,
  schedulePreview,
} from "./model";
import { CustomReminders } from "./CustomReminders";

export function JobForm({
  initial,
  data,
  busy,
  onSave,
}: {
  initial: MockJob;
  data: AppState;
  busy: boolean;
  onSave: (job: MockJob) => Promise<string | null>;
}) {
  const { colors, styles } = useThemeTokens();
  const [draft, setDraft] = useState<MockJob>({
    ...initial,
    currency: initial.currency ?? data.preferences.currency,
    reminderSettings: initial.reminderSettings ?? {
      ...data.preferences.defaultReminders,
      custom: data.preferences.defaultReminders.custom.map((item) => ({
        ...item,
      })),
    },
  });
  const [numbers, setNumbers] = useState(() => jobDraftNumbers(data, initial));
  const pending = useRef(false);
  const [saving, setSaving] = useState(false);
  const [editingReminder, setEditingReminder] = useState(false);
  const frozen = jobInProgress(data, initial.id);
  const currencyLocked = frozen || jobReferenced(data, initial.id);
  const [advanced, setAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = (changes: Partial<MockJob>) => {
    if (busy || saving) return;
    setDraft((value) => ({
      ...value,
      ...changes,
    }));
    setError(null);
  };
  const settings = draft.reminderSettings!;
  const updateSettings = (changes: Partial<JobReminderSettings>) =>
    update({ reminderSettings: { ...settings, ...changes } });
  const numeric = (
    label: string,
    key: keyof typeof numbers,
    disabled = false,
  ) => (
    <Field
      label={label}
      numeric
      value={numbers[key]}
      disabled={disabled || busy || saving}
      onChange={(value) => {
        setNumbers((values) => ({ ...values, [key]: value }));
        setError(null);
      }}
    />
  );
  const preview = schedulePreview(draft, localDate(new Date()));
  const save = () => {
    if (pending.current || busy || editingReminder) return;
    const result = prepareJobDraft(data, draft, numbers);
    if (result.error) {
      setError(result.error);
      setAdvanced(true);
      return;
    }
    const job = result.job;
    if (!job) return;
    const changedSchedule =
      initial.payFrequency && jobScheduleChanged(initial, job);
    const commit = async () => {
      if (pending.current) return;
      pending.current = true;
      setSaving(true);
      try {
        setError(await onSave(job));
      } catch {
        setError("Could not save. Your draft is still here. Please try again.");
      } finally {
        pending.current = false;
        setSaving(false);
      }
    };
    if (changedSchedule)
      Alert.alert(
        "Change pay schedule?",
        "Generated period boundaries will change. Existing received paychecks and shift dates will not be rewritten.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Save changes",
            onPress: () => {
              void commit();
            },
          },
        ],
      );
    else void commit();
  };
  return (
    <View style={styles.card} pointerEvents={busy || saving ? "none" : "auto"}>
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
      {numeric("Hourly rate", "hourlyRate", frozen)}
      <Text style={styles.cardMeta}>Currency</Text>
      <Choices
        value={draft.currency ?? "USD"}
        options={currencies.map((value) => ({ value, label: value }))}
        onChange={(currency) => update({ currency })}
        disabled={currencyLocked || busy || saving}
      />
      {currencyLocked && (
        <Text style={styles.cardMeta}>
          Currency is fixed while this job has work, deductions or receipts. Use
          a separate profile for another currency.
        </Text>
      )}
      <Text style={styles.cardMeta}>
        Rate changes apply to future work. Existing entries keep their pay
        rules.
      </Text>
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
          {numeric("OT After (hrs)", "overtimeThreshold", frozen)}
          {numeric("OT Multiplier", "overtimeMultiplier", frozen)}
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
                {schedulePreview(draft, draft.payPeriodStart ?? "").find(
                  (period) => period.label === "Current",
                )?.end ?? "Choose an anchor date"}
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
                  {numbers.payDelayDays.trim() &&
                  Number.isInteger(Number(numbers.payDelayDays)) &&
                  Number(numbers.payDelayDays) >= 0 &&
                  Number(numbers.payDelayDays) <= 366
                    ? ` · Expected pay ${addDays(period.end, Number(numbers.payDelayDays))}`
                    : ""}
                </Text>
              ))}
              {numeric("Pay delay after period end (days)", "payDelayDays")}
              <Text style={styles.cardMeta}>
                Expected dates are calculated from each period’s end and this
                delay. Actual received dates are entered in Pay.
              </Text>
            </View>
          )}
          <Text style={[styles.cardTitle, { marginTop: 18 }]}>
            Workday Defaults
          </Text>
          {numeric(
            "Typical lunch break (min)",
            "lunchMinutes",
            frozen || draft.lunchEnabled === false,
          )}
          <Toggle
            title="Include lunch break by default"
            value={draft.lunchEnabled ?? true}
            onChange={(lunchEnabled) => update({ lunchEnabled })}
            disabled={frozen}
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
            onEditingChange={setEditingReminder}
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
        title="Make default and select for Tracker"
        value={draft.isDefault ?? false}
        onChange={(isDefault) => {
          if (initial.isDefault && !isDefault)
            Alert.alert(
              "Active job",
              "Set another job active to replace this default.",
            );
          else if (workInProgress(data) && isDefault !== initial.isDefault)
            Alert.alert(
              "Shift in progress",
              "Clock out before changing the active job.",
            );
          else update({ isDefault });
        }}
      />
      {frozen && (
        <Text style={styles.cardMeta}>
          Finish or recover this job’s shift before changing pay or lunch
          defaults. Notes and reminder edits can be saved; reminder changes
          apply to running work.
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
      {editingReminder && (
        <Text style={styles.cardMeta}>
          Finish or cancel the reminder draft before saving the job.
        </Text>
      )}
      <Action
        title={busy || saving ? "Saving…" : "Save job"}
        disabled={busy || saving || editingReminder}
        onPress={save}
      />
    </View>
  );
}
