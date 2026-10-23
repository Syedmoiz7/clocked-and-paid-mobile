import { useState } from "react";
import { Alert, Text, View } from "react-native";
import type { CustomReminder } from "../../types";
import { Action, Choices, Field, Toggle } from "../../components/FormControls";
import { TimePickerField } from "../../components/TimePickerField";
import { useThemeTokens } from "../../providers/ThemeProvider";
import { useClockFormat } from "../settings/useClockFormat";
import { validateReminder } from "./model";

export function CustomReminders({
  value,
  onChange,
}: {
  value: CustomReminder[];
  onChange: (value: CustomReminder[]) => void;
}) {
  const { colors, styles } = useThemeTokens();
  const { timeLabel } = useClockFormat();
  const [editing, setEditing] = useState<CustomReminder | null>(null);
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Custom Reminders</Text>
      {value.length === 0 && (
        <Text style={styles.cardMeta}>
          No custom reminders yet. Add one below.
        </Text>
      )}
      {value.map((item) => (
        <View
          key={item.id}
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.border,
            marginTop: 12,
          }}
        >
          <Toggle
            title={item.name}
            value={item.enabled}
            onChange={(enabled) =>
              onChange(
                value.map((r) => (r.id === item.id ? { ...r, enabled } : r)),
              )
            }
          />
          <Text style={styles.cardMeta}>
            {item.trigger === "at-time"
              ? `At ${timeLabel(item.atTime)}`
              : `${item.offsetMinutes}m after ${item.trigger === "after-clock-in" ? "clock-in" : "lunch starts"}`}
            {item.repeatMinutes > 0 ? ` · repeats ${item.repeatMinutes}m` : ""}
          </Text>
          <Action
            title={`Edit ${item.name}`}
            onPress={() => setEditing(item)}
          />
          <Action
            title={`Delete ${item.name}`}
            onPress={() =>
              Alert.alert("Delete reminder?", item.name, [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => {
                    onChange(value.filter((r) => r.id !== item.id));
                    if (editing?.id === item.id) setEditing(null);
                  },
                },
              ])
            }
          />
        </View>
      ))}
      {editing ? (
        <ReminderEditor
          key={editing.id}
          initial={editing}
          onCancel={() => setEditing(null)}
          onSave={(item) => {
            onChange(
              value.some((r) => r.id === item.id)
                ? value.map((r) => (r.id === item.id ? item : r))
                : [...value, item],
            );
            setEditing(null);
          }}
        />
      ) : (
        <Action
          title="+ Add reminder"
          onPress={() =>
            setEditing({
              id: `reminder-${Date.now()}`,
              name: "",
              message: "",
              enabled: true,
              trigger: "after-clock-in",
              offsetMinutes: 60,
              atTime: "12:00",
              repeatMinutes: 0,
              priority: "medium",
            })
          }
        />
      )}
    </View>
  );
}

function ReminderEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: CustomReminder;
  onSave: (value: CustomReminder) => void;
  onCancel: () => void;
}) {
  const { colors, styles } = useThemeTokens();
  const [draft, setDraft] = useState(initial);
  const [offset, setOffset] = useState(String(initial.offsetMinutes));
  const [repeat, setRepeat] = useState(String(initial.repeatMinutes || 10));
  const [error, setError] = useState<string | null>(null);
  const update = (changes: Partial<CustomReminder>) => {
    setDraft((value) => ({ ...value, ...changes }));
    setError(null);
  };
  return (
    <View>
      <Field
        label="Reminder name"
        value={draft.name}
        onChange={(name) => update({ name })}
      />
      <Field
        label="Message (optional)"
        value={draft.message}
        onChange={(message) => update({ message })}
      />
      <Choices
        value={draft.trigger}
        options={[
          { value: "after-clock-in", label: "After clock-in" },
          { value: "after-lunch-start", label: "After lunch" },
          { value: "at-time", label: "At time" },
        ]}
        onChange={(trigger) =>
          update({ trigger: trigger as CustomReminder["trigger"] })
        }
      />
      {draft.trigger === "at-time" ? (
        <TimePickerField
          label="Reminder time"
          value={draft.atTime}
          onChange={(atTime) => update({ atTime })}
        />
      ) : (
        <Field
          numeric
          label="Minutes after trigger (1–480)"
          value={offset}
          onChange={setOffset}
        />
      )}
      <Toggle
        title="Repeat reminder"
        value={draft.repeatMinutes > 0}
        onChange={(enabled) => update({ repeatMinutes: enabled ? 10 : 0 })}
      />
      {draft.repeatMinutes > 0 && (
        <Field
          numeric
          label="Repeat interval (minutes)"
          value={repeat}
          onChange={setRepeat}
        />
      )}
      <Text style={styles.cardMeta}>Priority</Text>
      <Choices
        value={draft.priority}
        options={[
          { value: "low", label: "Low" },
          { value: "medium", label: "Medium" },
          { value: "high", label: "High" },
        ]}
        onChange={(priority) =>
          update({ priority: priority as CustomReminder["priority"] })
        }
      />
      {error && (
        <Text
          accessibilityRole="alert"
          style={{ color: colors.danger, marginTop: 10 }}
        >
          {error}
        </Text>
      )}
      <Action
        title="Save reminder"
        onPress={() => {
          const reminder = {
            ...draft,
            name: draft.name.trim(),
            offsetMinutes: offset.trim() ? Number(offset) : NaN,
            repeatMinutes:
              draft.repeatMinutes > 0
                ? repeat.trim()
                  ? Number(repeat)
                  : NaN
                : 0,
          };
          const error = validateReminder(reminder);
          if (error) setError(error);
          else onSave(reminder);
        }}
      />
      <Action title="Cancel reminder" onPress={onCancel} />
    </View>
  );
}
