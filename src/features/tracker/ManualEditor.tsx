import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Action } from "../../components/FormControls";
import { TimePickerField } from "../../components/TimePickerField";
import { useThemeTokens } from "../../providers/ThemeProvider";
import { timeValue } from "../history/model";
import { manualEntryAction, type ManualTimes } from "./model";
import type { Shift } from "../../types";

const fieldsFor = (shift: Shift | null): ManualTimes => ({
  start: timeValue(shift?.startedAt),
  lunchStart: timeValue(shift?.lunchStartedAt ?? shift?.historyLunchStart),
  lunchEnd: timeValue(shift?.historyLunchEnd),
  end: timeValue(shift?.endedAt),
});
export function ManualEditor({
  shift,
  editing,
  busy,
  onSave,
  onCancel,
}: {
  shift: Shift | null;
  editing: boolean;
  busy: boolean;
  onSave: (times: ManualTimes) => Promise<boolean>;
  onCancel: () => void;
}) {
  const { styles } = useThemeTokens();
  const [times, setTimes] = useState(() => fieldsFor(shift)),
    [saving, setSaving] = useState(false);
  const dirty = useRef(false),
    inFlight = useRef(false);
  useEffect(() => {
    if (!dirty.current) setTimes(fieldsFor(shift));
  }, [shift]);
  const update = (field: keyof ManualTimes, value: string) => {
    dirty.current = true;
    setTimes((previous) => ({
      ...previous,
      [field]: value,
      ...(field === "lunchStart" || field === "lunchEnd"
        ? { clearLunch: false }
        : {}),
    }));
  };
  const action = manualEntryAction(shift, times, editing);
  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.cardMeta}>{action.hint}</Text>
      <TimePickerField
        label="Clock In"
        disabled={busy || saving}
        value={times.start}
        onChange={(value) => update("start", value)}
      />
      <TimePickerField
        label="Lunch Start"
        disabled={busy || saving}
        value={times.lunchStart}
        onChange={(value) => update("lunchStart", value)}
      />
      <TimePickerField
        label="Lunch End"
        disabled={busy || saving}
        value={times.lunchEnd}
        onChange={(value) => update("lunchEnd", value)}
      />
      {times.lunchStart || times.lunchEnd || shift?.lunchMinutes ? (
        <Action
          title="Clear lunch"
          disabled={busy || saving}
          onPress={() => {
            dirty.current = true;
            setTimes((value) => ({
              ...value,
              lunchStart: "",
              lunchEnd: "",
              clearLunch: true,
            }));
          }}
        />
      ) : null}
      {times.lunchEnd && (
        <Action
          title="Clear Lunch End (resume lunch)"
          disabled={busy || saving || editing}
          onPress={() => update("lunchEnd", "")}
        />
      )}
      <TimePickerField
        label="Clock Out"
        disabled={busy || saving}
        value={times.end}
        onChange={(value) => update("end", value)}
      />
      <Action
        title={busy || saving ? "Saving…" : action.title}
        disabled={busy || saving || !times.start}
        onPress={() => {
          if (inFlight.current) return;
          inFlight.current = true;
          setSaving(true);
          void onSave(times)
            .then((saved) => {
              if (saved) {
                dirty.current = false;
                if (!shift && times.end) setTimes(fieldsFor(null));
                if (editing) onCancel();
              }
            })
            .finally(() => {
              inFlight.current = false;
              setSaving(false);
            });
        }}
      />
      {editing && (
        <Action
          title="Cancel correction"
          disabled={busy || saving}
          onPress={onCancel}
        />
      )}
    </View>
  );
}
