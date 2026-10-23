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
import { useThemeTokens } from "../providers/ThemeProvider";
import { localDate, validDate } from "../utils/dateOnly";
export function Action({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors, styles } = useThemeTokens();
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
  const { colors, styles } = useThemeTokens();
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
  const { colors, styles } = useThemeTokens();
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
  const { colors, styles } = useThemeTokens();
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
export function Field({
  label,
  value,
  onChange,
  numeric = false,
  multiline = false,
  secure = false,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  numeric?: boolean;
  multiline?: boolean;
  secure?: boolean;
  keyboardType?: import("react-native").TextInputProps["keyboardType"];
  autoCapitalize?: import("react-native").TextInputProps["autoCapitalize"];
}) {
  const { colors, styles } = useThemeTokens();
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={styles.cardMeta}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType ?? (numeric ? "decimal-pad" : "default")}
        autoCapitalize={secure ? "none" : autoCapitalize}
        autoCorrect={!secure && keyboardType !== "email-address"}
        multiline={multiline}
        secureTextEntry={secure}
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
