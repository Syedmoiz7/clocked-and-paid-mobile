import { useRef, useState } from "react";
import { Text, View } from "react-native";
import type { AppState, Shift } from "../../types";
import { Action, DateField } from "../../components/FormControls";
import { TimePickerField } from "../../components/TimePickerField";
import { useThemeTokens } from "../../providers/ThemeProvider";
import { useClockFormat } from "../settings/useClockFormat";
import { localDate, money, timeValue } from "../history/model";
import {
  completedShiftTotals,
  formatDuration,
  prepareRecovery,
  recoveryEndAt,
} from "./model";
export function RecoveryCard({
  shift,
  data,
  currency,
  payVisible,
  busy,
  onResolve,
  onDiscard,
}: {
  shift: Shift;
  data: Pick<AppState, "jobs" | "defaultPlan" | "todayPlan">;
  currency: string;
  payVisible: boolean;
  busy: boolean;
  onResolve: (id: string, endedAt: string) => Promise<boolean>;
  onDiscard: () => void;
}) {
  const { styles, colors } = useThemeTokens(),
    { timeLabel } = useClockFormat();
  const [date, setDate] = useState(shift.date),
    [time, setTime] = useState(""),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const pending = useRef(false);
  const endedAt = recoveryEndAt(date, time);
  const preview = endedAt ? prepareRecovery(shift, endedAt, data) : null;
  const valid = preview && !("error" in preview);
  const totals = valid
    ? completedShiftTotals(preview.entry, data.jobs, data.defaultPlan, currency)
    : null;
  return (
    <View style={[styles.trackerCard, { borderColor: colors.warning }]}>
      <Text style={styles.cardTitle}>Unfinished shift</Text>
      <Text style={styles.cardMeta}>
        Clocked in {shift.date} at {timeLabel(shift.startedAt)}. Choose when you
        actually finished, then review the duration before saving.
      </Text>
      <View pointerEvents={busy || saving ? "none" : "auto"}>
        <DateField
          label="Actual clock-out date"
          value={date}
          onChange={(value) => {
            setDate(value);
            setError("");
          }}
        />
        <TimePickerField
          label="Actual clock-out time"
          value={time}
          onChange={(value) => {
            setTime(value);
            setError("");
          }}
        />
      </View>
      <Action
        title="Use current date and time"
        disabled={busy || saving}
        onPress={() => {
          const now = new Date();
          setDate(localDate(now));
          setTime(timeValue(now.toISOString()));
          setError("");
        }}
      />
      {time && !endedAt ? (
        <Text accessibilityRole="alert" style={{ color: colors.warning }}>
          Choose a valid clock-out date and time.
        </Text>
      ) : null}
      {preview && "error" in preview && (
        <Text accessibilityRole="alert" style={{ color: colors.warning }}>
          {preview.error}
        </Text>
      )}
      {valid && totals && (
        <View style={{ marginTop: 12, gap: 6 }}>
          <Text style={styles.cardTitle}>Review completed shift</Text>
          <Text style={styles.cardMeta}>
            {shift.date} {timeLabel(shift.startedAt)} → {date} {timeLabel(time)}
          </Text>
          <Text style={styles.cardMeta}>
            Elapsed: {formatDuration(preview.elapsedSeconds)} · Worked:{" "}
            {formatDuration(preview.workedSeconds)}
          </Text>
          <Text style={styles.cardMeta}>
            Lunch: {preview.entry.lunchMinutes.toFixed(1)}m · Breaks:{" "}
            {preview.entry.breakMinutes.toFixed(1)}m
          </Text>
          <Text style={styles.cardMeta}>
            Gross earnings:{" "}
            {payVisible ? money(totals.total, totals.currency) : "•••••"}
          </Text>
          <Text style={[styles.cardMeta, { color: colors.warning }]}>
            Check the dates carefully. Choosing today for an older unfinished
            shift includes all elapsed days.
          </Text>
        </View>
      )}
      {error && (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {error}
        </Text>
      )}
      <Action
        title={busy || saving ? "Saving…" : "Save completed shift"}
        disabled={busy || saving || !valid}
        onPress={() => {
          if (pending.current || !endedAt || !valid) return;
          pending.current = true;
          setSaving(true);
          setError("");
          void onResolve(shift.id, endedAt)
            .then((saved) => {
              if (!saved)
                setError(
                  "The shift could not be saved. Review it and try again.",
                );
            })
            .catch(() =>
              setError(
                "Could not save. Your unfinished shift is still available.",
              ),
            )
            .finally(() => {
              pending.current = false;
              setSaving(false);
            });
        }}
      />
      <Action
        title="Discard shift"
        disabled={busy || saving}
        onPress={onDiscard}
      />
    </View>
  );
}
