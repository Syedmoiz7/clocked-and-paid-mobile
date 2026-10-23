import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { TimePickerField } from "../../components/TimePickerField";
import {
  Action,
  Choices,
  DateField,
  Field,
  Toggle,
} from "../../components/FormControls";
export {
  Action,
  Choices,
  DateField,
  Field,
  Toggle,
} from "../../components/FormControls";
import { useThemeTokens } from "../../providers/ThemeProvider";
import type { MockJob } from "../../types";
import { currencies, type EntryDraft } from "./model";
function OptionalTime({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { colors, styles } = useThemeTokens();
  return (
    <View style={{ marginTop: 12 }}>
      <TimePickerField label={label} value={value} onChange={onChange} />
      {value && (
        <Pressable accessibilityRole="button" onPress={() => onChange("")}>
          <Text style={{ color: colors.accent, paddingVertical: 8 }}>
            Clear {label.toLowerCase()}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
export function EntryForm({
  initial,
  jobs,
  existingDates = [],
  editing = false,
  onSave,
  onCancel,
}: {
  initial: EntryDraft;
  jobs: MockJob[];
  existingDates?: string[];
  editing?: boolean;
  onSave: (draft: EntryDraft) => string | null;
  onCancel: () => void;
}) {
  const { colors, styles } = useThemeTokens();
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const update = (changes: Partial<EntryDraft>) => {
    setError(null);
    setDraft((current) => ({ ...current, ...changes }));
  };
  const project = draft.entryType === "project";
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>
        {editing ? "Edit" : "Add"}{" "}
        {project ? "Flat-Rate Project" : "Past Shift"}
      </Text>
      <DateField
        label={project ? "Start date" : "Date"}
        value={draft.date}
        onChange={(date) => update({ date })}
      />
      {!editing && !project && existingDates.includes(draft.date) && (
        <Text style={[styles.cardMeta, { color: colors.warning }]}>
          This date already has an entry. This will add a separate shift.
        </Text>
      )}
      {project ? (
        <>
          <Field
            label="Project name"
            value={draft.projectName}
            onChange={(projectName) => update({ projectName })}
          />
          <DateField
            label="End date"
            value={draft.endDate}
            onChange={(endDate) => update({ endDate })}
          />
          <Field
            label="Flat payout"
            numeric
            value={draft.flatAmount}
            onChange={(flatAmount) => update({ flatAmount })}
          />
          <Text style={styles.cardMeta}>Currency</Text>
          <Choices
            options={currencies.map((code) => ({ value: code, label: code }))}
            value={draft.currency}
            onChange={(currency) => update({ currency })}
          />
        </>
      ) : (
        <>
          <OptionalTime
            label="Clock In"
            value={draft.start}
            onChange={(start) => update({ start })}
          />
          <OptionalTime
            label="Lunch Start"
            value={draft.lunchStart}
            onChange={(lunchStart) => update({ lunchStart })}
          />
          <OptionalTime
            label="Lunch End"
            value={draft.lunchEnd}
            onChange={(lunchEnd) => update({ lunchEnd })}
          />
          <OptionalTime
            label="Clock Out"
            value={draft.end}
            onChange={(end) => update({ end })}
          />
          {!draft.lunchStart && !draft.lunchEnd && (
            <Field
              label="Recorded lunch (minutes)"
              numeric
              value={draft.lunchMinutes}
              onChange={(lunchMinutes) => update({ lunchMinutes })}
            />
          )}
          <Toggle
            title="Paid lunch (counts toward paid hours)"
            value={draft.lunchPaid}
            onChange={(lunchPaid) => update({ lunchPaid })}
          />
          <Field
            label="Unpaid breaks (minutes)"
            numeric
            value={draft.breakMinutes}
            onChange={(breakMinutes) => update({ breakMinutes })}
          />
          <Field
            label="Break label"
            value={draft.breakLabel}
            onChange={(breakLabel) => update({ breakLabel })}
          />
          {draft.breaks.map((item) => (
            <Text key={item.id} style={styles.cardMeta}>
              {item.label || "Break"}: {item.start} →{" "}
              {item.end || "In progress"}
            </Text>
          ))}
          <Field
            label="Custom hourly rate (optional)"
            numeric
            value={draft.customRate}
            onChange={(customRate) => update({ customRate })}
          />
          <Field
            label="Tips earned"
            numeric
            value={draft.tips}
            onChange={(tips) => update({ tips })}
          />
          {Number(draft.tips) > 0 && (
            <Choices
              options={[
                { value: "cash", label: "Cash" },
                { value: "paycheck", label: "On Paycheck" },
              ]}
              value={draft.tipType}
              onChange={(tipType) =>
                update({ tipType: tipType as EntryDraft["tipType"] })
              }
            />
          )}
        </>
      )}
      <Text style={styles.cardMeta}>Job (optional)</Text>
      <Choices
        value={draft.jobId ?? ""}
        onChange={(jobId) => update({ jobId: jobId || null })}
        options={[
          { value: "", label: "No job assigned" },
          ...jobs
            .filter((job) => !job.archived || job.id === draft.jobId)
            .map((job) => ({
              value: job.id,
              label: job.archived ? `${job.name} (removed)` : job.name,
            })),
        ]}
      />
      <Field
        label="Notes (optional)"
        multiline
        value={draft.notes}
        onChange={(notes) => update({ notes })}
      />
      <Toggle
        title="Payment received"
        value={draft.paid}
        onChange={(paid) => update({ paid })}
      />
      {error && (
        <Text
          accessibilityRole="alert"
          style={[styles.cardMeta, { color: colors.danger }]}
        >
          {error}
        </Text>
      )}
      <Action
        title={
          editing ? "Save Changes" : project ? "Save Project" : "Save Entry"
        }
        onPress={() => setError(onSave(draft))}
      />
      <Action title="Cancel" onPress={onCancel} />
    </View>
  );
}
