import { useState } from "react";
import {
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { TimePickerField } from "../../components/TimePickerField";
import { colors, styles } from "../../theme";
import type { MockJob } from "../../types";
import { currencies, localDate, validDate, type EntryDraft } from "./model";
export function Action({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.secondaryButton,
        { marginTop: 10, opacity: disabled ? 0.4 : 1 },
      ]}
    >
      <Text style={styles.secondaryButtonText}>{title}</Text>
    </Pressable>
  );
}
export function Toggle({
  title,
  value,
  onChange,
}: {
  title: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        marginTop: 12,
      }}
    >
      <Text style={[styles.cardMeta, { flex: 1 }]}>{title}</Text>
      <Switch
        accessibilityLabel={title}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.accent }}
      />
    </View>
  );
}
export function Choices({
  options,
  value,
  onChange,
}: {
  options: {
    value: string;
    label: string;
  }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingVertical: 8 }}
    >
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="button"
          accessibilityState={{ selected: option.value === value }}
          onPress={() => onChange(option.value)}
          style={{
            backgroundColor:
              value === option.value ? colors.accentSoft : colors.background,
            borderColor: value === option.value ? colors.accent : colors.border,
            borderWidth: 1,
            borderRadius: 12,
            padding: 10,
          }}
        >
          <Text
            style={{
              color: value === option.value ? colors.accent : colors.muted,
            }}
          >
            {option.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(new Date());
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={styles.cardMeta}>{label}</Text>
      <Action
        title={value || "Choose date"}
        onPress={() => {
          setDraft(
            validDate(value) ? new Date(`${value}T12:00:00`) : new Date(),
          );
          setOpen(true);
        }}
      />
      {open && (
        <View>
          <DateTimePicker
            mode="date"
            display="spinner"
            themeVariant="dark"
            textColor={colors.text}
            value={draft}
            onChange={(event, date) => {
              if (event.type === "dismissed") setOpen(false);
              else if (date) setDraft(date);
            }}
          />
          <Action
            title="Done"
            onPress={() => {
              onChange(localDate(draft));
              setOpen(false);
            }}
          />
          <Action title="Cancel" onPress={() => setOpen(false)} />
        </View>
      )}
    </View>
  );
}
function Field({
  label,
  value,
  onChange,
  numeric = false,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  numeric?: boolean;
  multiline?: boolean;
}) {
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={styles.cardMeta}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? "decimal-pad" : "default"}
        multiline={multiline}
        style={{
          backgroundColor: colors.background,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 10,
          color: colors.text,
          padding: 12,
          marginTop: 6,
        }}
      />
    </View>
  );
}
function OptionalTime({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
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
          ...jobs.map((job) => ({ value: job.id, label: job.name })),
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
