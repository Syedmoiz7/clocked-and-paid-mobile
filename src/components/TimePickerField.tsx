import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useThemeTokens } from "../providers/ThemeProvider";
import { useClockFormat } from "../features/settings/useClockFormat";

function parseTime(value: string) {
  const [hours = NaN, minutes = NaN] = value.split(":").map(Number);
  return Number.isInteger(hours) &&
    Number.isInteger(minutes) &&
    hours >= 0 &&
    hours < 24 &&
    minutes >= 0 &&
    minutes < 60
    ? hours * 60 + minutes
    : null;
}

function dateForValue(value: string) {
  const date = new Date();
  const minutes = parseTime(value);
  if (minutes !== null)
    date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date;
}

function valueForDate(value: Date) {
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}

type Props = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function TimePickerField({
  label,
  value,
  onChange,
  placeholder = "Choose time",
  disabled = false,
}: Props) {
  const { colors, styles } = useThemeTokens();
  const { format, timeLabel } = useClockFormat();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date | null>(null);

  const show = () => {
    setDraft(dateForValue(value));
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    setDraft(null);
  };
  const commit = () => {
    if (draft) onChange(valueForDate(draft));
    close();
  };

  return (
    <View>
      {label && <Text style={styles.cardMeta}>{label}</Text>}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ?? placeholder}
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={show}
        style={{
          backgroundColor: colors.background,
          borderColor: open ? colors.accent : colors.border,
          borderRadius: 12,
          borderWidth: 1,
          marginTop: label ? 5 : 0,
          padding: 13,
        }}
      >
        <Text
          style={{
            color: value ? colors.text : colors.muted,
            fontFamily: value ? "monospace" : undefined,
          }}
        >
          {value ? timeLabel(value) : placeholder}
        </Text>
      </Pressable>
      {open && draft && (
        <View
          style={{
            backgroundColor: colors.surfaceRaised,
            borderColor: colors.border,
            borderRadius: 12,
            borderWidth: 1,
            marginTop: 6,
            overflow: "hidden",
          }}
        >
          <DateTimePicker
            value={draft}
            mode="time"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            themeVariant="dark"
            textColor={colors.text}
            is24Hour={format === "24h"}
            locale={format === "24h" ? "en_GB" : "en_US"}
            onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
              if (event.type === "dismissed") close();
              else if (selectedDate) {
                if (Platform.OS === "android") {
                  onChange(valueForDate(selectedDate));
                  close();
                } else setDraft(selectedDate);
              }
            }}
          />
          {Platform.OS !== "android" && (
            <>
              <Pressable
                onPress={commit}
                accessibilityRole="button"
                disabled={disabled}
                style={[styles.button, { borderRadius: 0, minHeight: 44 }]}
              >
                <Text style={styles.buttonText}>Done</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={close}
                style={[styles.secondaryButton, { borderRadius: 0 }]}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
            </>
          )}
        </View>
      )}
    </View>
  );
}
