import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { colors, styles } from "../theme";

function parseTime(value: string) {
  const [hours = NaN, minutes = NaN] = value.split(":").map(Number);
  return Number.isInteger(hours) && Number.isInteger(minutes) && hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60 ? hours * 60 + minutes : null;
}

function dateForValue(value: string) {
  const date = new Date();
  const minutes = parseTime(value);
  if (minutes !== null) date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date;
}

function valueForDate(value: Date) {
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}

function displayValue(value: string) {
  const minutes = parseTime(value);
  if (minutes === null) return value;
  const date = dateForValue(value);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
}

type Props = { label?: string; value: string; onChange: (value: string) => void; placeholder?: string };

export function TimePickerField({ label, value, onChange, placeholder = "Choose time" }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date | null>(null);

  const show = () => { setDraft(dateForValue(value)); setOpen(true); };
  const close = () => { setOpen(false); setDraft(null); };
  const commit = () => { if (draft) onChange(valueForDate(draft)); close(); };

  return <View>
    {label && <Text style={styles.cardMeta}>{label}</Text>}
    <Pressable onPress={show} style={{ backgroundColor: colors.background, borderColor: open ? colors.accent : colors.border, borderRadius: 12, borderWidth: 1, marginTop: label ? 5 : 0, padding: 13 }}>
      <Text style={{ color: value ? colors.text : colors.muted, fontFamily: value ? "monospace" : undefined }}>{value ? displayValue(value) : placeholder}</Text>
    </Pressable>
    {open && draft && <View style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: 12, borderWidth: 1, marginTop: 6, overflow: "hidden" }}>
      <DateTimePicker value={draft} mode="time" display="spinner" is24Hour={false} onChange={(event: DateTimePickerEvent, selectedDate?: Date) => { if (event.type === "dismissed") close(); else if (selectedDate) setDraft(selectedDate); }} />
      <Pressable onPress={commit} style={[styles.button, { borderRadius: 0, minHeight: 44 }]}><Text style={styles.buttonText}>Done</Text></Pressable>
    </View>}
  </View>;
}
