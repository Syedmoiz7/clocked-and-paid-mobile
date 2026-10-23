import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PaywallCard } from "../components/PaywallCard";
import { TimePickerField } from "../components/TimePickerField";
import { useThemeTokens } from "../providers/ThemeProvider";
import type {
  AppPreferences,
  MockJob,
  ReminderSettings,
  Shift,
  TodayPlan,
} from "../types";
import { useClockFormat } from "../features/settings/useClockFormat";
import { money } from "../features/history/model";

type ManualTimes = {
  start: string;
  lunchStart: string;
  lunchEnd: string;
  end: string;
};
type Props = {
  preferences: AppPreferences;
  payVisible: boolean;
  onPayVisible: (value: boolean) => void;
  activeShift: Shift | null;
  extraShifts: Shift[];
  orphanedShift: Shift | null;
  completedToday: Shift[];
  todayPlan: TodayPlan;
  defaultPlan: TodayPlan;
  jobs: MockJob[];
  selectedJobId: string;
  deductionRate: number;
  breakIncludedInRemaining: boolean;
  reminders: ReminderSettings;
  notificationPermission: "default" | "granted" | "denied";
  notificationPromptDismissed: boolean;
  onPlanChange: (changes: Partial<TodayPlan>) => void;
  onSavePlanDefault: () => void;
  onResetPlan: () => void;
  onJobChange: (id: string) => void;
  onRemindersChange: (changes: Partial<ReminderSettings>) => void;
  onRequestNotifications: () => void;
  onDismissNotificationPrompt: () => void;
  onClockIn: () => void;
  onClockOut: () => void;
  onStartExtraShift: (jobId: string) => void;
  onClockOutExtraShift: (shift: Shift) => void;
  onResolveOrphanedShift: () => void;
  onDiscardOrphanedShift: () => void;
  onToggleBreakRemaining: (value: boolean) => void;
  onLunch: () => void;
  onBreak: (...args: unknown[]) => void;
  onManualTimes: (times: ManualTimes) => boolean;
  onEditTimes: (id: string, times: ManualTimes) => boolean;
  onPremium: () => void;
};

const quotes = [
  "Small steps every day add up to big results.",
  "Your time is your most valuable asset.",
  "Progress, not perfection.",
];
const parseTime = (value: string) => {
  const [h = NaN, m = NaN] = value.split(":").map(Number);
  return Number.isInteger(h) &&
    Number.isInteger(m) &&
    h >= 0 &&
    h < 24 &&
    m >= 0 &&
    m < 60
    ? h * 60 + m
    : null;
};
const formatTime = (minutes: number) => {
  const value = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
};
const formatDuration = (seconds: number) =>
  [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const { colors, styles } = useThemeTokens();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => setOpen((value) => !value)}
        style={{ alignItems: "center", flexDirection: "row" }}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardMeta}>{subtitle}</Text>
        </View>
        <Text style={{ color: colors.muted, fontSize: 22 }}>
          {open ? "⌃" : "⌄"}
        </Text>
      </Pressable>
      {open && <View style={{ gap: 14, marginTop: 16 }}>{children}</View>}
    </View>
  );
}

function ToggleRow({
  label,
  enabled,
  onPress,
}: {
  label: string;
  enabled: boolean;
  onPress: () => void;
}) {
  const { colors, styles } = useThemeTokens();
  return (
    <Pressable
      onPress={onPress}
      style={{
        alignItems: "center",
        borderBottomColor: colors.border,
        borderBottomWidth: 1,
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 12,
      }}
    >
      <Text style={{ color: colors.text, fontWeight: "700" }}>{label}</Text>
      <View
        style={{
          backgroundColor: enabled ? colors.accent : colors.surfaceRaised,
          borderColor: enabled ? colors.accent : colors.border,
          borderRadius: 16,
          borderWidth: 1,
          height: 28,
          justifyContent: "center",
          paddingHorizontal: 4,
          width: 48,
        }}
      >
        <View
          style={{
            alignSelf: enabled ? "flex-end" : "flex-start",
            backgroundColor: enabled ? "#fff7fa" : colors.muted,
            borderRadius: 10,
            height: 18,
            width: 18,
          }}
        />
      </View>
    </Pressable>
  );
}

function NumericField({
  label,
  value,
  onChange,
  keyboardType = "decimal-pad",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  keyboardType?: "decimal-pad" | "number-pad";
}) {
  const { colors, styles } = useThemeTokens();
  return (
    <View>
      <Text style={styles.cardMeta}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        style={{
          backgroundColor: colors.background,
          borderColor: colors.border,
          borderRadius: 10,
          borderWidth: 1,
          color: colors.text,
          marginTop: 5,
          padding: 12,
        }}
      />
    </View>
  );
}

export function TrackerScreen(props: Props) {
  const { colors, styles } = useThemeTokens();
  const { timeLabel, format } = useClockFormat();
  const { preferences, payVisible, onPayVisible } = props;
  const {
    activeShift,
    extraShifts,
    orphanedShift,
    completedToday,
    todayPlan,
    defaultPlan,
    jobs: allJobs,
    selectedJobId,
    deductionRate,
    breakIncludedInRemaining,
    reminders,
    notificationPermission,
    notificationPromptDismissed,
    onPlanChange,
    onSavePlanDefault,
    onResetPlan,
    onJobChange,
    onRemindersChange,
    onRequestNotifications,
    onDismissNotificationPrompt,
    onClockIn,
    onClockOut,
    onStartExtraShift,
    onClockOutExtraShift,
    onResolveOrphanedShift,
    onDiscardOrphanedShift,
    onToggleBreakRemaining,
    onLunch,
    onBreak,
    onManualTimes,
    onEditTimes,
    onPremium,
  } = props;
  const availableJobs = allJobs.filter((job) => !job.archived);
  const jobs = availableJobs.length > 1 ? availableJobs : [];
  const currency =
    activeShift?.currency ??
    allJobs.find((job) => job.id === (activeShift?.jobId ?? selectedJobId))
      ?.currency ??
    preferences.currency;
  const [now, setNow] = useState(new Date());
  const [quote, setQuote] = useState(0);
  const [payMode, setPayMode] = useState<"gross" | "net">("gross");
  const setPayVisible = (update: (value: boolean) => boolean) =>
    onPayVisible(update(payVisible));
  const [completedOpen, setCompletedOpen] = useState(true);

  const [manual, setManual] = useState<ManualTimes>({
    start: "",
    lunchStart: "",
    lunchEnd: "",
    end: "",
  });
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [calcMode, setCalcMode] = useState<"forward" | "reverse" | "duration">(
    "forward",
  );
  const [calcStart, setCalcStart] = useState("09:00");
  const [calcEnd, setCalcEnd] = useState("17:00");
  const [calcTarget, setCalcTarget] = useState("17:00");
  const [calcHours, setCalcHours] = useState("8");
  const [calcLunchEnabled, setCalcLunchEnabled] = useState(true);
  const [calcLunchMinutes, setCalcLunchMinutes] = useState("30");
  const [confirmApply, setConfirmApply] = useState(false);
  useEffect(() => {
    setCalcHours(String(defaultPlan.plannedHours));
    setCalcLunchEnabled(defaultPlan.lunchEnabled);
    setCalcLunchMinutes(String(defaultPlan.lunchMinutes));
    if (preferences.typicalStartTime)
      setCalcStart(preferences.typicalStartTime);
  }, [
    defaultPlan.plannedHours,
    defaultPlan.lunchEnabled,
    defaultPlan.lunchMinutes,
    preferences.typicalStartTime,
  ]);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const working = Boolean(activeShift);
  const lunchActive = Boolean(activeShift?.lunchStartedAt);
  const breakActive = Boolean(activeShift?.breakStartedAt);
  const elapsed = activeShift
    ? Math.max(
        0,
        Math.floor((now.getTime() - Date.parse(activeShift.startedAt)) / 1000),
      )
    : 0;
  const lunchSeconds = activeShift?.lunchStartedAt
    ? Math.max(
        0,
        Math.floor(
          (now.getTime() - Date.parse(activeShift.lunchStartedAt)) / 1000,
        ),
      )
    : 0;
  const worked = Math.max(
    0,
    elapsed -
      (lunchSeconds || (activeShift?.lunchMinutes ?? 0) * 60) -
      (activeShift?.breakMinutes ?? 0) * 60,
  );
  const regular = Math.min(worked, todayPlan.overtimeThreshold * 3600);
  const gross =
    (regular / 3600) * todayPlan.hourlyRate +
    (Math.max(0, worked - regular) / 3600) *
      todayPlan.hourlyRate *
      todayPlan.overtimeMultiplier;
  const pay = payMode === "net" ? gross * (1 - deductionRate) : gross;
  const progress = Math.min(
    100,
    Math.round((worked / Math.max(1, todayPlan.plannedHours * 3600)) * 100),
  );
  const timer =
    todayPlan.timerDirection === "count-down"
      ? Math.abs(todayPlan.plannedHours * 3600 - worked)
      : elapsed;
  const lunchRemaining = Math.max(
    0,
    todayPlan.lunchMinutes * 60 - lunchSeconds,
  );
  const status = lunchActive
    ? "On Lunch"
    : breakActive
      ? "On Break"
      : working
        ? "Working"
        : "Off Duty";
  const statusColor = lunchActive
    ? colors.warning
    : breakActive
      ? colors.blue
      : working
        ? colors.accent
        : colors.muted;
  const summaryRegular = Math.min(worked, todayPlan.overtimeThreshold * 3600);
  const summaryOvertime = Math.max(0, worked - summaryRegular);
  const summaryLunch = activeShift?.lunchMinutes ?? 0;
  const calculatorResult = useMemo(() => {
    const lunch = calcLunchEnabled
      ? Math.max(0, Number(calcLunchMinutes) || 0)
      : 0;
    if (calcMode === "forward") {
      const start = parseTime(calcStart);
      const hours = Number(calcHours);
      return start !== null && Number.isFinite(hours)
        ? `Clock out at ${timeLabel(formatTime(start + hours * 60 + lunch))}`
        : "Enter a valid start time";
    }
    if (calcMode === "reverse") {
      const end = parseTime(calcTarget);
      const hours = Number(calcHours);
      return end !== null && Number.isFinite(hours)
        ? `Clock in by ${timeLabel(formatTime(end - hours * 60 - lunch))}`
        : "Enter a valid end time";
    }
    const start = parseTime(calcStart);
    const end = parseTime(calcEnd);
    const minutes =
      start !== null && end !== null ? Math.max(0, end - start - lunch) : null;
    return minutes === null
      ? "Enter valid start and end times"
      : `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m worked`;
  }, [
    calcEnd,
    format,
    calcHours,
    calcLunchEnabled,
    calcLunchMinutes,
    calcMode,
    calcStart,
    calcTarget,
  ]);
  const applyCalculator = () => {
    const lunch = calcLunchEnabled
      ? Math.max(0, Number(calcLunchMinutes) || 0)
      : 0;
    if (calcMode === "forward") {
      const start = parseTime(calcStart);
      const hours = Number(calcHours);
      if (start !== null && Number.isFinite(hours))
        onPlanChange({
          planningMode: "end-time",
          plannedClockOut: formatTime(start + hours * 60 + lunch),
          plannedHours: hours,
          lunchEnabled: calcLunchEnabled,
          lunchMinutes: lunch,
        });
    } else if (calcMode === "reverse") {
      const end = parseTime(calcTarget);
      const hours = Number(calcHours);
      if (end !== null && Number.isFinite(hours))
        onPlanChange({
          planningMode: "end-time",
          plannedClockOut: formatTime(end),
          plannedHours: hours,
          lunchEnabled: calcLunchEnabled,
          lunchMinutes: lunch,
        });
    } else {
      const start = parseTime(calcStart);
      const end = parseTime(calcEnd);
      if (start !== null && end !== null)
        onPlanChange({
          planningMode: "end-time",
          plannedClockOut: formatTime(end),
          plannedHours: Math.max(0, end - start - lunch) / 60,
          lunchEnabled: calcLunchEnabled,
          lunchMinutes: lunch,
        });
    }
    setConfirmApply(false);
  };
  const shiftTime = (value: string | null | undefined) =>
    value ? new Date(value).toTimeString().slice(0, 5) : "";
  const saveManual = () => {
    if (!manual.start || !manual.end) {
      Alert.alert("Missing time", "Clock in and Clock out are required.");
      return;
    }
    if (
      ![manual.start, manual.lunchStart, manual.lunchEnd, manual.end]
        .filter(Boolean)
        .every((value) => parseTime(value) !== null)
    ) {
      Alert.alert("Invalid time", "Use the time picker or a valid time.");
      return;
    }
    if (
      !(editingShiftId
        ? onEditTimes(editingShiftId, manual)
        : onManualTimes(manual))
    ) {
      Alert.alert("Invalid range", "Check the clock-out and lunch times.");
      return;
    }
    setManual({ start: "", lunchStart: "", lunchEnd: "", end: "" });
    setEditingShiftId(null);
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {orphanedShift && (
          <View style={[styles.card, { borderColor: colors.warning }]}>
            <Text
              style={{ color: colors.warning, fontSize: 13, fontWeight: "900" }}
            >
              Unfinished shift found
            </Text>
            <Text style={[styles.cardMeta, { marginTop: 6 }]}>
              This shift started on {orphanedShift.date} and was never clocked
              out.
            </Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <Pressable
                onPress={onResolveOrphanedShift}
                style={[styles.button, { flex: 1 }]}
              >
                <Text style={styles.buttonText}>Clock out now</Text>
              </Pressable>
              <Pressable
                onPress={onDiscardOrphanedShift}
                style={[styles.secondaryButton, { flex: 1 }]}
              >
                <Text style={styles.secondaryButtonText}>Discard</Text>
              </Pressable>
            </View>
          </View>
        )}
        {working &&
          notificationPermission === "default" &&
          !notificationPromptDismissed && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                Allow reminder notifications?
              </Text>
              <Text style={[styles.cardMeta, { marginTop: 6 }]}>
                Get lunch and return-to-work alerts while the app is in the
                background.
              </Text>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <Pressable
                  onPress={onRequestNotifications}
                  style={[styles.button, { flex: 1 }]}
                >
                  <Text style={styles.buttonText}>Allow</Text>
                </Pressable>
                <Pressable
                  onPress={onDismissNotificationPrompt}
                  style={[styles.secondaryButton, { flex: 1 }]}
                >
                  <Text style={styles.secondaryButtonText}>Not now</Text>
                </Pressable>
              </View>
            </View>
          )}
        <View
          style={{
            borderBottomColor: colors.border,
            borderBottomWidth: 1,
            paddingBottom: 18,
          }}
        >
          <View
            style={{
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <View>
              <Text style={styles.title}>Today&apos;s Shift</Text>
              <Text style={styles.subtitle}>
                {now.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </Text>
            </View>
            <View
              style={{
                backgroundColor: `${statusColor}1c`,
                borderColor: `${statusColor}55`,
                borderRadius: 20,
                borderWidth: 1,
                paddingHorizontal: 12,
                paddingVertical: 7,
              }}
            >
              <Text
                style={{ color: statusColor, fontSize: 12, fontWeight: "800" }}
              >
                ● {status}
              </Text>
            </View>
          </View>
          {preferences.showDailyQuote && (
            <View
              style={{
                backgroundColor: `${colors.accent}0d`,
                borderColor: `${colors.accent}25`,
                borderRadius: 14,
                borderWidth: 1,
                flexDirection: "row",
                marginTop: 16,
                padding: 12,
              }}
            >
              <Text
                style={{ color: colors.accent, fontSize: 16, marginRight: 8 }}
              >
                ✦
              </Text>
              <Text
                style={{ color: colors.muted, flex: 1, fontStyle: "italic" }}
              >
                {quotes[quote]}
              </Text>
              <Pressable
                onPress={() => setQuote((value) => (value + 1) % quotes.length)}
              >
                <Text style={{ color: colors.accent, fontSize: 18 }}>›</Text>
              </Pressable>
            </View>
          )}
        </View>
        <View style={styles.card}>
          <Text style={styles.cardMeta}>JOB FOR THIS SHIFT</Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 8,
              marginTop: 8,
            }}
          >
            {jobs.map((job) => (
              <Pressable
                key={job.id}
                disabled={working}
                onPress={() => onJobChange(job.id)}
                style={{
                  backgroundColor:
                    selectedJobId === job.id
                      ? `${job.color}30`
                      : colors.background,
                  borderColor:
                    selectedJobId === job.id ? job.color : colors.border,
                  borderRadius: 18,
                  borderWidth: 1,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              >
                <Text
                  style={{
                    color: selectedJobId === job.id ? job.color : colors.muted,
                    fontSize: 12,
                    fontWeight: "800",
                  }}
                >
                  {job.name} · {money(job.hourlyRate, job.currency ?? "USD")}/hr
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={{ alignItems: "center", marginTop: 18 }}>
            <Text style={styles.cardMeta}>
              {working ? "TIME WORKING" : "READY TO TRACK"}
            </Text>
            <Text
              style={{
                color: working ? colors.accent : colors.text,
                fontSize: 48,
                fontWeight: "900",
                marginTop: 10,
              }}
            >
              {todayPlan.timerDirection === "count-down" &&
              worked > todayPlan.plannedHours * 3600
                ? "+"
                : ""}
              {formatDuration(timer)}
            </Text>
            <Pressable
              onPress={() =>
                onPlanChange({
                  timerDirection:
                    todayPlan.timerDirection === "count-up"
                      ? "count-down"
                      : "count-up",
                })
              }
              style={{ marginTop: 8 }}
            >
              <Text
                style={{ color: colors.blue, fontSize: 12, fontWeight: "800" }}
              >
                {todayPlan.timerDirection === "count-up"
                  ? "Count up"
                  : "Count down"}{" "}
                · Change
              </Text>
            </Pressable>
          </View>
          <Pressable
            onPress={working ? onClockOut : onClockIn}
            style={[
              styles.button,
              {
                backgroundColor: working ? colors.danger : colors.accent,
                marginTop: 22,
              },
            ]}
          >
            <Text style={styles.buttonText}>
              {working ? "Clock out" : "Clock in"}
            </Text>
          </Pressable>
          {working && (
            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <Pressable
                onPress={onLunch}
                style={[styles.secondaryButton, { flex: 1 }]}
              >
                <Text style={styles.secondaryButtonText}>
                  {lunchActive ? "End lunch" : "Start lunch"}
                </Text>
              </Pressable>
              <Pressable
                onPress={onBreak}
                style={[styles.secondaryButton, { flex: 1 }]}
              >
                <Text style={styles.secondaryButtonText}>
                  {breakActive ? "End break" : "Take break"}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
        {working && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Shift Progress</Text>
            <View
              style={{
                backgroundColor: colors.background,
                borderRadius: 6,
                height: 8,
                marginTop: 18,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  backgroundColor: colors.accent,
                  height: "100%",
                  width: `${progress}%`,
                }}
              />
            </View>
            <Text style={[styles.cardMeta, { marginTop: 8 }]}>
              {progress}% of {todayPlan.plannedHours}h target ·{" "}
              {formatDuration(worked)} worked
            </Text>
            <Text style={[styles.cardMeta, { marginTop: 10 }]}>
              Remaining:{" "}
              {formatDuration(
                Math.max(
                  0,
                  todayPlan.plannedHours * 3600 -
                    worked +
                    (breakIncludedInRemaining
                      ? (activeShift?.breakMinutes ?? 0) * 60
                      : 0),
                ),
              )}{" "}
              {breakIncludedInRemaining ? "including break" : "work only"}
            </Text>
            <Pressable
              onPress={() => onToggleBreakRemaining(!breakIncludedInRemaining)}
              style={{ alignSelf: "flex-start", marginTop: 12 }}
            >
              <Text
                style={{ color: colors.blue, fontSize: 12, fontWeight: "800" }}
              >
                {breakIncludedInRemaining
                  ? "Exclude break from remaining"
                  : "Include break in remaining"}
              </Text>
            </Pressable>
          </View>
        )}
        {lunchActive && (
          <View style={[styles.card, { borderColor: colors.warning }]}>
            <Text style={{ color: colors.warning, fontWeight: "900" }}>
              {lunchRemaining === 0 ? "Lunch overdue" : "Lunch countdown"}
            </Text>
            <Text
              style={{
                color: colors.warning,
                fontSize: 26,
                fontWeight: "900",
                marginTop: 6,
              }}
            >
              {formatDuration(lunchRemaining)}
            </Text>
          </View>
        )}
        {(extraShifts.length > 0 ||
          (working &&
            preferences.allowConcurrentShifts &&
            availableJobs.length > 1)) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Additional Active Shifts</Text>
            {extraShifts.map((shift) => {
              const job = allJobs.find((item) => item.id === shift.jobId);
              const seconds = Math.max(
                0,
                Math.floor(
                  (now.getTime() - Date.parse(shift.startedAt)) / 1000,
                ),
              );
              return (
                <View
                  key={shift.id}
                  style={{
                    borderBottomColor: colors.border,
                    borderBottomWidth: 1,
                    paddingVertical: 12,
                  }}
                >
                  <View
                    style={{
                      alignItems: "center",
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <View>
                      <Text
                        style={{
                          color: job?.color ?? colors.text,
                          fontWeight: "800",
                        }}
                      >
                        {job?.name ?? "Additional job"}
                      </Text>
                      <Text style={styles.cardMeta}>
                        {formatDuration(seconds)} active ·{" "}
                        {money(
                          job?.hourlyRate ?? todayPlan.hourlyRate,
                          job?.currency ?? "USD",
                        )}
                        /hr
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => onClockOutExtraShift(shift)}
                      style={[
                        styles.secondaryButton,
                        { borderColor: colors.danger },
                      ]}
                    >
                      <Text
                        style={{
                          color: colors.danger,
                          fontSize: 12,
                          fontWeight: "800",
                        }}
                      >
                        Clock out
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
            {working &&
              preferences.allowConcurrentShifts &&
              availableJobs.some(
                (job) =>
                  job.id !== activeShift?.jobId &&
                  !extraShifts.some((shift) => shift.jobId === job.id),
              ) && (
                <View style={{ gap: 8, marginTop: 12 }}>
                  <Text style={styles.cardMeta}>Start another job</Text>
                  {availableJobs
                    .filter(
                      (job) =>
                        job.id !== activeShift?.jobId &&
                        !extraShifts.some((shift) => shift.jobId === job.id),
                    )
                    .map((job) => (
                      <Pressable
                        key={job.id}
                        onPress={() => onStartExtraShift(job.id)}
                        style={styles.secondaryButton}
                      >
                        <Text style={styles.secondaryButtonText}>
                          {job.name} · Start shift
                        </Text>
                      </Pressable>
                    ))}
                </View>
              )}
          </View>
        )}
        <View style={styles.card}>
          <View
            style={{
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <View>
              <Text style={styles.cardTitle}>Today&apos;s Summary</Text>
              <Text style={styles.cardMeta}>
                {payMode === "net"
                  ? `${Math.round(deductionRate * 100)}% deductions`
                  : "Before deductions"}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["gross", "net"] as const).map((mode) => (
                <Pressable key={mode} onPress={() => setPayMode(mode)}>
                  <Text
                    style={{
                      color: payMode === mode ? colors.accent : colors.muted,
                      fontSize: 11,
                      fontWeight: "800",
                    }}
                  >
                    {mode.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Pressable onPress={() => setPayVisible((value) => !value)}>
            <Text
              style={{
                color: colors.accent,
                fontSize: 42,
                fontWeight: "900",
                marginTop: 14,
              }}
            >
              {payVisible ? money(pay, currency) : "•••••"}
            </Text>
          </Pressable>
          <Text style={styles.cardMeta}>
            {formatDuration(worked)} worked ·{" "}
            {money(todayPlan.hourlyRate, currency)}/hr
          </Text>
          <View
            style={{
              borderTopColor: colors.border,
              borderTopWidth: 1,
              flexDirection: "row",
              flexWrap: "wrap",
              marginTop: 16,
              paddingTop: 12,
            }}
          >
            <View style={{ marginBottom: 10, width: "50%" }}>
              <Text style={styles.cardMeta}>Worked</Text>
              <Text style={{ color: colors.text, fontWeight: "900" }}>
                {formatDuration(worked)}
              </Text>
            </View>
            <View style={{ marginBottom: 10, width: "50%" }}>
              <Text style={styles.cardMeta}>Lunch</Text>
              <Text style={{ color: colors.muted, fontWeight: "900" }}>
                {summaryLunch ? formatDuration(summaryLunch * 60) : "—"}
              </Text>
            </View>
            <View style={{ width: "50%" }}>
              <Text style={styles.cardMeta}>Regular</Text>
              <Text style={{ color: colors.text, fontWeight: "900" }}>
                {formatDuration(summaryRegular)}
              </Text>
            </View>
            <View style={{ width: "50%" }}>
              <Text
                style={{
                  color: summaryOvertime > 0 ? colors.danger : colors.muted,
                  fontSize: 12,
                }}
              >
                Overtime
              </Text>
              <Text
                style={{
                  color: summaryOvertime > 0 ? colors.danger : colors.muted,
                  fontWeight: "900",
                }}
              >
                {summaryOvertime > 0 ? formatDuration(summaryOvertime) : "—"}
              </Text>
            </View>
          </View>
        </View>
        {completedToday.length > 0 && (
          <View style={{ marginTop: 22 }}>
            <Pressable
              onPress={() => setCompletedOpen((value) => !value)}
              style={{ flexDirection: "row" }}
            >
              <Text style={styles.cardTitle}>
                Completed Today ({completedToday.length})
              </Text>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 22,
                  marginLeft: "auto",
                }}
              >
                {completedOpen ? "⌃" : "⌄"}
              </Text>
            </Pressable>
            {completedOpen &&
              completedToday.map((shift) => (
                <View key={shift.id} style={[styles.card, { marginTop: 10 }]}>
                  <Text style={styles.cardTitle}>{shift.date}</Text>
                  <Text style={styles.cardMeta}>
                    {timeLabel(shift.startedAt)} –{" "}
                    {shift.endedAt ? timeLabel(shift.endedAt) : "Active"}
                  </Text>
                  {preferences.enableManualEditing && (
                    <Pressable
                      onPress={() => {
                        setEditingShiftId(shift.id);
                        setManual({
                          start: shiftTime(shift.startedAt),
                          lunchStart: "",
                          lunchEnd: "",
                          end: shiftTime(shift.endedAt),
                        });
                      }}
                      style={{ alignSelf: "flex-start", marginTop: 10 }}
                    >
                      <Text
                        style={{
                          color: colors.blue,
                          fontSize: 12,
                          fontWeight: "800",
                        }}
                      >
                        Edit times
                      </Text>
                    </Pressable>
                  )}
                  <Text
                    style={{
                      color: colors.accent,
                      fontSize: 20,
                      fontWeight: "900",
                      marginTop: 8,
                    }}
                  >
                    {payVisible
                      ? money(
                          shift.earnings,
                          shift.currency ??
                            allJobs.find((job) => job.id === shift.jobId)
                              ?.currency ??
                            "USD",
                        )
                      : "•••••"}
                  </Text>
                </View>
              ))}
          </View>
        )}
        {preferences.enableManualEditing && (
          <Section
            title={!working ? "Enter Today's Times" : "Manual Adjustments"}
            subtitle={
              !working
                ? "Started late or forgot to clock in?"
                : "Override any time entry"
            }
          >
            <Text style={styles.cardMeta}>Tap a field to choose a time.</Text>
            <TimePickerField
              label="Clock in"
              value={manual.start}
              onChange={(value) =>
                setManual((state) => ({ ...state, start: value }))
              }
            />
            <TimePickerField
              label="Lunch start"
              value={manual.lunchStart}
              onChange={(value) =>
                setManual((state) => ({ ...state, lunchStart: value }))
              }
            />
            <TimePickerField
              label="Lunch end"
              value={manual.lunchEnd}
              onChange={(value) =>
                setManual((state) => ({ ...state, lunchEnd: value }))
              }
            />
            <TimePickerField
              label="Clock out"
              value={manual.end}
              onChange={(value) =>
                setManual((state) => ({ ...state, end: value }))
              }
            />
            <Pressable
              onPress={saveManual}
              style={[styles.secondaryButton, { borderColor: colors.accent }]}
            >
              <Text
                style={[styles.secondaryButtonText, { color: colors.accent }]}
              >
                Save time entry
              </Text>
            </Pressable>
          </Section>
        )}
        <Section
          title="Today's Plan"
          subtitle={`${todayPlan.plannedHours}h work · ${todayPlan.lunchEnabled ? `${todayPlan.lunchMinutes}m lunch` : "no lunch"}`}
        >
          <Text style={styles.cardMeta}>Plan by</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["duration", "end-time"] as const).map((mode) => (
              <Pressable
                key={mode}
                onPress={() =>
                  onPlanChange({
                    planningMode: mode,
                    plannedClockOut:
                      mode === "duration" ? null : todayPlan.plannedClockOut,
                  })
                }
                style={{
                  backgroundColor:
                    todayPlan.planningMode === mode
                      ? colors.accent
                      : colors.background,
                  borderColor: colors.border,
                  borderRadius: 18,
                  borderWidth: 1,
                  paddingHorizontal: 15,
                  paddingVertical: 9,
                }}
              >
                <Text
                  style={{
                    color:
                      todayPlan.planningMode === mode
                        ? "#fff7fa"
                        : colors.muted,
                    fontWeight: "800",
                  }}
                >
                  {mode === "duration" ? "Duration" : "End Time"}
                </Text>
              </Pressable>
            ))}
          </View>
          {todayPlan.planningMode === "duration" ? (
            <View>
              <Text style={styles.cardMeta}>Planned Work Hours</Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 8,
                  marginTop: 7,
                }}
              >
                {[6, 7, 8, 9, 10, 12].map((hours) => (
                  <Pressable
                    key={hours}
                    onPress={() => onPlanChange({ plannedHours: hours })}
                    style={{
                      backgroundColor:
                        todayPlan.plannedHours === hours
                          ? colors.accent
                          : colors.background,
                      borderColor: colors.border,
                      borderRadius: 18,
                      borderWidth: 1,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                    }}
                  >
                    <Text
                      style={{
                        color:
                          todayPlan.plannedHours === hours
                            ? "#fff7fa"
                            : colors.muted,
                        fontWeight: "800",
                      }}
                    >
                      {hours}h
                    </Text>
                  </Pressable>
                ))}
                <TextInput
                  value={String(todayPlan.plannedHours)}
                  onChangeText={(value) => {
                    const parsed = Number(value);
                    if (parsed > 0 && parsed <= 24)
                      onPlanChange({ plannedHours: parsed });
                  }}
                  keyboardType="decimal-pad"
                  placeholder="Custom"
                  placeholderTextColor={colors.muted}
                  style={{
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    borderRadius: 18,
                    borderWidth: 1,
                    color: colors.text,
                    minWidth: 80,
                    paddingHorizontal: 12,
                  }}
                />
              </View>
            </View>
          ) : (
            <TimePickerField
              label="Clock out by"
              value={todayPlan.plannedClockOut ?? "17:00"}
              onChange={(value) => onPlanChange({ plannedClockOut: value })}
            />
          )}
          <ToggleRow
            label="Taking lunch today"
            enabled={todayPlan.lunchEnabled}
            onPress={() =>
              onPlanChange({ lunchEnabled: !todayPlan.lunchEnabled })
            }
          />
          {todayPlan.lunchEnabled && (
            <NumericField
              label="Lunch duration (minutes)"
              value={String(todayPlan.lunchMinutes)}
              onChange={(value) => {
                const parsed = Number(value);
                if (parsed >= 0 && parsed <= 180)
                  onPlanChange({ lunchMinutes: parsed });
              }}
              keyboardType="number-pad"
            />
          )}
          <Text style={styles.cardMeta}>Pay Overrides</Text>
          <NumericField
            label="Hourly rate"
            value={String(todayPlan.hourlyRate)}
            onChange={(value) => {
              const parsed = Number(value);
              if (parsed >= 0) onPlanChange({ hourlyRate: parsed });
            }}
          />
          <NumericField
            label="OT After (hrs)"
            value={String(todayPlan.overtimeThreshold)}
            onChange={(value) => {
              const parsed = Number(value);
              if (parsed > 0) onPlanChange({ overtimeThreshold: parsed });
            }}
          />
          <NumericField
            label="OT Multiplier"
            value={String(todayPlan.overtimeMultiplier)}
            onChange={(value) => {
              const parsed = Number(value);
              if (parsed >= 1) onPlanChange({ overtimeMultiplier: parsed });
            }}
          />
          <View
            style={{
              borderTopColor: colors.border,
              borderTopWidth: 1,
              gap: 10,
              paddingTop: 14,
            }}
          >
            <Text style={styles.cardMeta}>Plan Defaults</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={onSavePlanDefault}
                style={[
                  styles.secondaryButton,
                  { borderColor: colors.accent, flex: 1 },
                ]}
              >
                <Text
                  style={[styles.secondaryButtonText, { color: colors.accent }]}
                >
                  Save default
                </Text>
              </Pressable>
              <Pressable
                onPress={onResetPlan}
                style={[styles.secondaryButton, { flex: 1 }]}
              >
                <Text style={styles.secondaryButtonText}>Reset plan</Text>
              </Pressable>
            </View>
            <Text style={styles.cardMeta}>
              Saved: {defaultPlan.plannedHours}h ·{" "}
              {money(defaultPlan.hourlyRate, currency)}/hr
            </Text>
          </View>
        </Section>
        <Section title="Reminders" subtitle="Lunch & return-to-work alerts">
          <Text style={styles.cardMeta}>
            Configure local reminders for this mock account.
          </Text>
          <ToggleRow
            label="Lunch reminder"
            enabled={reminders.lunchReminder}
            onPress={() =>
              onRemindersChange({ lunchReminder: !reminders.lunchReminder })
            }
          />
          <ToggleRow
            label="Return-to-work reminder"
            enabled={reminders.returnReminder}
            onPress={() =>
              onRemindersChange({ returnReminder: !reminders.returnReminder })
            }
          />
          <NumericField
            label="Custom reminder after (minutes)"
            value={
              reminders.customReminderMinutes === null
                ? ""
                : String(reminders.customReminderMinutes)
            }
            onChange={(value) => {
              const parsed = Number(value);
              onRemindersChange({
                customReminderMinutes:
                  value.trim() === ""
                    ? null
                    : parsed > 0 && parsed <= 1440
                      ? parsed
                      : reminders.customReminderMinutes,
              });
            }}
            keyboardType="number-pad"
          />
          <NumericField
            label="Snooze duration (minutes)"
            value={String(reminders.reminderSnoozeMinutes)}
            onChange={(value) => {
              const parsed = Number(value);
              if (parsed >= 1 && parsed <= 120)
                onRemindersChange({ reminderSnoozeMinutes: parsed });
            }}
            keyboardType="number-pad"
          />
          <ToggleRow
            label="Reminder overlay"
            enabled={reminders.reminderOverlay}
            onPress={() =>
              onRemindersChange({ reminderOverlay: !reminders.reminderOverlay })
            }
          />
          <ToggleRow
            label="Reminder sound"
            enabled={reminders.reminderSound}
            onPress={() =>
              onRemindersChange({ reminderSound: !reminders.reminderSound })
            }
          />
          <ToggleRow
            label="Tab flash"
            enabled={reminders.reminderTabFlash}
            onPress={() =>
              onRemindersChange({
                reminderTabFlash: !reminders.reminderTabFlash,
              })
            }
          />
          <Pressable onPress={onPremium}>
            <Text style={{ color: colors.accent, fontWeight: "800" }}>
              Unlock advanced reminder rules with Premium →
            </Text>
          </Pressable>
        </Section>
        <Section
          title="Hours Calculator"
          subtitle="Work out hours from a target clock-out"
        >
          <Text style={styles.cardMeta}>
            Apply results here to update Today&apos;s Plan.
          </Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {(["forward", "reverse", "duration"] as const).map((mode) => (
              <Pressable
                key={mode}
                onPress={() => setCalcMode(mode)}
                style={{
                  backgroundColor:
                    calcMode === mode ? colors.accent : colors.background,
                  borderColor: colors.border,
                  borderRadius: 12,
                  borderWidth: 1,
                  flex: 1,
                  paddingVertical: 9,
                }}
              >
                <Text
                  style={{
                    color: calcMode === mode ? "#fff7fa" : colors.muted,
                    fontSize: 10,
                    fontWeight: "800",
                    textAlign: "center",
                  }}
                >
                  {mode === "forward"
                    ? "Start → End"
                    : mode === "reverse"
                      ? "End → Start"
                      : "Duration"}
                </Text>
              </Pressable>
            ))}
          </View>
          {calcMode === "forward" && (
            <>
              <TimePickerField
                label="Start time"
                value={calcStart}
                onChange={setCalcStart}
              />
              <NumericField
                label="Hours to work"
                value={calcHours}
                onChange={setCalcHours}
              />
            </>
          )}
          {calcMode === "reverse" && (
            <>
              <TimePickerField
                label="Clock out by"
                value={calcTarget}
                onChange={setCalcTarget}
              />
              <NumericField
                label="Hours to work"
                value={calcHours}
                onChange={setCalcHours}
              />
            </>
          )}
          {calcMode === "duration" && (
            <>
              <TimePickerField
                label="Start time"
                value={calcStart}
                onChange={setCalcStart}
              />
              <TimePickerField
                label="End time"
                value={calcEnd}
                onChange={setCalcEnd}
              />
            </>
          )}
          <ToggleRow
            label="Taking lunch"
            enabled={calcLunchEnabled}
            onPress={() => setCalcLunchEnabled((value) => !value)}
          />
          {calcLunchEnabled && (
            <NumericField
              label="Lunch duration (minutes)"
              value={calcLunchMinutes}
              onChange={(value) => {
                const parsed = Number(value);
                if (parsed >= 0 && parsed <= 180) setCalcLunchMinutes(value);
              }}
              keyboardType="number-pad"
            />
          )}
          <Text
            style={{ color: colors.accent, fontSize: 20, fontWeight: "900" }}
          >
            {calculatorResult}
          </Text>
          {confirmApply ? (
            <View style={{ gap: 8 }}>
              <Text style={styles.cardMeta}>
                Apply this result to Today&apos;s Plan?
              </Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  onPress={applyCalculator}
                  style={[styles.button, { flex: 1 }]}
                >
                  <Text style={styles.buttonText}>Confirm</Text>
                </Pressable>
                <Pressable
                  onPress={() => setConfirmApply(false)}
                  style={[styles.secondaryButton, { flex: 1 }]}
                >
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => setConfirmApply(true)}
              style={styles.button}
            >
              <Text style={styles.buttonText}>Apply to Today&apos;s Plan</Text>
            </Pressable>
          )}
        </Section>
        <PaywallCard
          onPress={onPremium}
          title="Unlock smart reminders"
          description="Get lunch, return-to-work, and custom job reminders with Premium."
        />
      </ScrollView>
    </SafeAreaView>
  );
}
