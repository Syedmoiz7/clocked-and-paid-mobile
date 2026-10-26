import { useEffect, useState, type ReactNode } from "react";
import {
  AppState as NativeAppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PaywallCard } from "../components/PaywallCard";
import { TimePickerField } from "../components/TimePickerField";
import { useThemeTokens } from "../providers/ThemeProvider";
import type {
  AppPreferences,
  Deduction,
  MockJob,
  ReminderSettings,
  Shift,
  TodayPlan,
} from "../types";
import { useClockFormat } from "../features/settings/useClockFormat";
import { money } from "../features/history/model";
import {
  formatDuration,
  trackerMetrics,
  type ManualTimes,
} from "../features/tracker/model";
import { TodaySummaryCard } from "../features/tracker/TodaySummaryCard";
import type { DailySummarySource } from "../features/tracker/dailySummary";
import { Calculator } from "../features/tracker/Calculator";
import { ManualEditor } from "../features/tracker/ManualEditor";
import { EditTimesModal } from "../features/tracker/EditTimesModal";
import { PayVisibilityButton } from "../features/tracker/PayVisibilityButton";
import { CompletedShiftCard } from "../features/tracker/CompletedShiftCard";
import { RecoveryCard } from "../features/tracker/RecoveryCard";
import { Action, Field } from "../components/FormControls";
import { getDailyQuote, QUOTE_COUNT } from "../features/tracker/quotes";
import { localDate } from "../utils/dateOnly";
import { jobAlerts, jobPlan } from "../features/jobs/model";

type Props = {
  busy: boolean;
  deductions: Deduction[];
  canCalculate: boolean;
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
  summaryData: DailySummarySource;
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
  onResolveOrphanedShift: (id: string, endedAt: string) => Promise<boolean>;
  onDiscardOrphanedShift: () => void;
  onToggleBreakRemaining: (value: boolean) => void;
  onLunch: () => void;
  onBreak: (label?: string) => void;
  onManualTimes: (times: ManualTimes) => Promise<boolean>;
  onEditTimes: (id: string, times: ManualTimes) => Promise<boolean>;
  onPremium: () => void;
};

function Section({
  title,
  subtitle,
  children,
  defaultOpen = false,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const { colors, styles } = useThemeTokens();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
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
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled }}
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
  allowEmpty = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  keyboardType?: "decimal-pad" | "number-pad";
  allowEmpty?: boolean;
}) {
  const { colors, styles } = useThemeTokens();
  const [draft, setDraft] = useState(value),
    [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(value);
  }, [value, focused]);
  return (
    <View>
      <Text style={styles.cardMeta}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={draft}
        keyboardType={keyboardType}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChangeText={(text) => {
          setDraft(text);
          if (
            (allowEmpty && !text.trim()) ||
            (text.trim() && Number.isFinite(Number(text)))
          )
            onChange(text);
        }}
        style={{
          backgroundColor: colors.background,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 10,
          color: colors.text,
          marginTop: 5,
          padding: 12,
        }}
      />
    </View>
  );
}

export function TrackerScreen(props: Props) {
  const { width, fontScale } = useWindowDimensions();
  const compactHeader = width < 430 || fontScale > 1.15;
  const { colors, styles } = useThemeTokens();
  const { timeLabel, format } = useClockFormat();
  const { preferences, payVisible, onPayVisible, busy, deductions } = props;
  const { canCalculate } = props;
  const {
    activeShift,
    extraShifts,
    orphanedShift,
    completedToday,
    todayPlan,
    defaultPlan,
    jobs: allJobs,
    selectedJobId,
    summaryData,
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
  const dailyQuote = getDailyQuote("local-workspace", localDate(now), quote);
  const [completedOpen, setCompletedOpen] = useState(true);

  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [breakLabel, setBreakLabel] = useState("");
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = setInterval(refresh, 1000);
    const listener = NativeAppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, []);

  const working = Boolean(activeShift);
  const lunchActive = Boolean(activeShift?.lunchStartedAt);
  const breakActive = Boolean(activeShift?.breakStartedAt);
  const metrics = trackerMetrics(activeShift, todayPlan, now.getTime());
  const { worked, progress } = metrics;
  const countdown = todayPlan.timerDirection === "count-down";
  const projectedRemaining =
    metrics.projected == null ? 0 : (metrics.projected - now.getTime()) / 1000;
  const timer = breakActive
    ? metrics.liveBreak
    : lunchActive
      ? countdown
        ? Math.max(0, todayPlan.lunchMinutes * 60 - metrics.liveLunch)
        : metrics.liveLunch
      : countdown
        ? Math.abs(projectedRemaining)
        : worked;
  const timerLabel = breakActive
    ? "On Break"
    : lunchActive
      ? countdown
        ? "On Lunch — Back By"
        : "On Lunch"
      : !working
        ? "Ready to track"
        : countdown
          ? projectedRemaining >= 0
            ? "Until estimated finish"
            : "Past estimated finish"
          : "Time Working";
  const lunchRemaining = Math.max(
    0,
    todayPlan.lunchMinutes * 60 - metrics.liveLunch,
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
  const editingShift =
    summaryData.history.find((shift) => shift.id === editingShiftId) ?? null;
  const currentJob = allJobs.find(
    (job) => job.id === (activeShift?.jobId ?? selectedJobId),
  );
  const defaultTodayPlan = currentJob
    ? jobPlan(currentJob, defaultPlan)
    : defaultPlan;
  const planIsDefault = (
    Object.keys(defaultTodayPlan) as Array<keyof TodayPlan>
  ).every((key) => todayPlan[key] === defaultTodayPlan[key]);
  const ruleSettings = currentJob?.reminderSettings ?? {
    ...preferences.defaultReminders,
    lunchMode: reminders.lunchReminder
      ? preferences.defaultReminders.lunchMode === "off"
        ? "relative"
        : preferences.defaultReminders.lunchMode
      : "off",
    returnReminder: reminders.returnReminder,
  };
  const reminderSchedule =
    activeShift && currentJob
      ? jobAlerts(activeShift, {
          ...currentJob,
          lunchEnabled: todayPlan.lunchEnabled,
          lunchMinutes: todayPlan.lunchMinutes,
          reminderSettings: ruleSettings,
        })
      : [];
  const lunchDue = reminderSchedule.find((item) =>
    item.key.includes(":lunch:"),
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View
            style={{
              borderBottomColor: colors.border,
              borderBottomWidth: 1,
              paddingBottom: 18,
            }}
          >
            <View
              style={{
                flexDirection: compactHeader ? "column" : "row",
                alignItems: compactHeader ? "stretch" : "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <View style={{ flexShrink: 1 }}>
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
                  flexDirection: compactHeader ? "row" : "column",
                  flexWrap: "wrap",
                  alignItems: compactHeader ? "center" : "flex-end",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <PayVisibilityButton
                  visible={payVisible}
                  onToggle={() => onPayVisible(!payVisible)}
                />
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
                    style={{
                      color: statusColor,
                      fontSize: 12,
                      fontWeight: "800",
                    }}
                  >
                    ● {status}
                  </Text>
                </View>
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
                  {dailyQuote.text} — {dailyQuote.author}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Previous quote"
                  onPress={() =>
                    setQuote((value) => (value + QUOTE_COUNT - 1) % QUOTE_COUNT)
                  }
                >
                  <Text style={{ color: colors.accent, fontSize: 18 }}>‹</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Next quote"
                  onPress={() => setQuote((value) => (value + 1) % QUOTE_COUNT)}
                >
                  <Text style={{ color: colors.accent, fontSize: 18 }}>›</Text>
                </Pressable>
              </View>
            )}
          </View>
          {orphanedShift && (
            <RecoveryCard
              key={orphanedShift.id}
              shift={orphanedShift}
              data={summaryData}
              currency={preferences.currency}
              payVisible={payVisible}
              busy={busy}
              onResolve={onResolveOrphanedShift}
              onDiscard={onDiscardOrphanedShift}
            />
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
          <View style={styles.card}>
            {jobs.length > 0 ? (
              <Text style={styles.cardMeta}>JOB FOR THIS SHIFT</Text>
            ) : (
              <Text style={styles.cardMeta}>
                {availableJobs[0]?.name ??
                  "Add a job in Jobs to start tracking"}
              </Text>
            )}
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
                  disabled={
                    working ||
                    busy ||
                    extraShifts.some((shift) => shift.jobId === job.id)
                  }
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
                      color:
                        selectedJobId === job.id ? job.color : colors.muted,
                      fontSize: 12,
                      fontWeight: "800",
                    }}
                  >
                    {job.name} · {money(job.hourlyRate, job.currency ?? "USD")}
                    /hr
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={{ alignItems: "center", marginTop: 18 }}>
              <Text style={styles.cardMeta}>{timerLabel.toUpperCase()}</Text>
              <Text
                style={{
                  color: working ? colors.accent : colors.text,
                  fontSize: 48,
                  fontWeight: "900",
                  marginTop: 10,
                }}
              >
                {working &&
                !lunchActive &&
                !breakActive &&
                countdown &&
                projectedRemaining < 0
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
                  style={{
                    color: colors.blue,
                    fontSize: 12,
                    fontWeight: "800",
                  }}
                >
                  {todayPlan.timerDirection === "count-up"
                    ? "Count up"
                    : "Count down"}{" "}
                  · Change
                </Text>
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={
                busy ||
                (!working && (!availableJobs.length || Boolean(orphanedShift)))
              }
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
                {busy ? "Saving…" : working ? "Clock out" : "Clock in"}
              </Text>
            </Pressable>
            {working && (
              <View style={{ gap: 10, marginTop: 12 }}>
                {(lunchActive ||
                  (todayPlan.lunchEnabled &&
                    !activeShift?.historyLunchEnd &&
                    !activeShift?.lunchMinutes)) && (
                  <Action
                    title={lunchActive ? "End lunch" : "Start lunch"}
                    disabled={busy || breakActive}
                    onPress={onLunch}
                  />
                )}
                {!breakActive && !lunchActive && (
                  <Field
                    label="Break label (optional)"
                    value={breakLabel}
                    onChange={setBreakLabel}
                  />
                )}
                <Action
                  title={breakActive ? "End break" : "Take break"}
                  disabled={busy || lunchActive}
                  onPress={() => {
                    onBreak(breakLabel.trim() || "General break");
                    setBreakLabel("");
                  }}
                />
                {breakActive && (
                  <Text style={styles.cardMeta}>
                    {activeShift?.breakLabel ?? "General break"} ·{" "}
                    {formatDuration(metrics.liveBreak)} unpaid
                  </Text>
                )}
              </View>
            )}
          </View>
          {lunchDue && (
            <View
              style={[
                styles.card,
                {
                  borderColor:
                    now.getTime() >= lunchDue.at
                      ? colors.warning
                      : colors.border,
                },
              ]}
            >
              <Text style={styles.cardTitle}>
                {now.getTime() >= lunchDue.at
                  ? "Lunch reminder overdue"
                  : "Lunch by"}{" "}
                {timeLabel(new Date(lunchDue.at).toISOString())}
              </Text>
              <Text style={styles.cardMeta}>
                Based on {currentJob?.name}'s reminder rules.
              </Text>
            </View>
          )}
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
                {breakIncludedInRemaining
                  ? "Work + upcoming lunch remaining: "
                  : "Work remaining: "}
                {formatDuration(
                  breakIncludedInRemaining
                    ? metrics.remainingTotal
                    : metrics.remainingWork,
                )}
              </Text>
              <Text style={[styles.cardMeta, { marginTop: 10 }]}>
                Estimated clock-out:{" "}
                {metrics.projected
                  ? timeLabel(
                      new Date(
                        Math.max(now.getTime(), metrics.projected),
                      ).toISOString(),
                    )
                  : "—"}
              </Text>
              <Pressable
                onPress={() =>
                  onToggleBreakRemaining(!breakIncludedInRemaining)
                }
                style={{ alignSelf: "flex-start", marginTop: 12 }}
              >
                <Text
                  style={{
                    color: colors.blue,
                    fontSize: 12,
                    fontWeight: "800",
                  }}
                >
                  {breakIncludedInRemaining
                    ? "Show work time only"
                    : "Include upcoming lunch"}
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
              <Text style={styles.cardMeta}>
                Back by{" "}
                {activeShift?.lunchStartedAt
                  ? timeLabel(
                      new Date(
                        Date.parse(activeShift.lunchStartedAt) +
                          todayPlan.lunchMinutes * 60000,
                      ).toISOString(),
                    )
                  : "—"}
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
                        disabled={busy}
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
                          disabled={busy}
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
          <TodaySummaryCard
            data={summaryData}
            now={now.getTime()}
            payVisible={payVisible}
          />
          {completedToday.length > 0 && (
            <View style={{ marginTop: 22 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: completedOpen }}
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
                  <CompletedShiftCard
                    key={shift.id}
                    shift={shift}
                    jobs={allJobs}
                    plan={defaultPlan}
                    currency={preferences.currency}
                    payVisible={payVisible}
                    canEdit={preferences.enableManualEditing}
                    busy={busy}
                    onEdit={() => setEditingShiftId(shift.id)}
                  />
                ))}
            </View>
          )}

          {preferences.enableManualEditing && (
            <Section
              key={activeShift?.id ?? "new-entry"}
              defaultOpen={!working}
              title={!working ? "Enter Today's Times" : "Manual Adjustments"}
              subtitle="Clock-in, lunch and clock-out corrections"
            >
              <ManualEditor
                key={activeShift?.id ?? "new-entry"}
                shift={activeShift}
                editing={false}
                busy={busy}
                onSave={onManualTimes}
                onCancel={() => {}}
              />
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
                  <NumericField
                    label="Custom work hours"
                    value={String(todayPlan.plannedHours)}
                    onChange={(value) => {
                      const hours = Number(value);
                      if (hours > 0 && hours <= 24)
                        onPlanChange({ plannedHours: hours });
                    }}
                  />
                </View>
              </View>
            ) : (
              <TimePickerField
                label="Clock out by"
                value={todayPlan.plannedClockOut ?? ""}
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
                if (Number.isFinite(parsed) && parsed >= 0)
                  onPlanChange({ hourlyRate: parsed });
              }}
            />
            <NumericField
              label="OT After (hrs)"
              value={String(todayPlan.overtimeThreshold)}
              onChange={(value) => {
                const parsed = Number(value);
                if (parsed > 0 && parsed <= 24)
                  onPlanChange({ overtimeThreshold: parsed });
              }}
            />
            <NumericField
              label="OT Multiplier"
              value={String(todayPlan.overtimeMultiplier)}
              onChange={(value) => {
                const parsed = Number(value);
                if (parsed >= 1 && parsed <= 4)
                  onPlanChange({ overtimeMultiplier: parsed });
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
                  disabled={busy || currency !== preferences.currency}
                  accessibilityRole="button"
                  accessibilityState={{
                    disabled: busy || currency !== preferences.currency,
                  }}
                  onPress={onSavePlanDefault}
                  style={[
                    styles.secondaryButton,
                    {
                      borderColor: colors.accent,
                      flex: 1,
                      opacity:
                        busy || currency !== preferences.currency ? 0.45 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.secondaryButtonText,
                      { color: colors.accent },
                    ]}
                  >
                    Save global defaults
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: busy || planIsDefault }}
                  disabled={busy || planIsDefault}
                  onPress={onResetPlan}
                  style={[
                    styles.secondaryButton,
                    { flex: 1, opacity: busy || planIsDefault ? 0.45 : 1 },
                  ]}
                >
                  <Text style={styles.secondaryButtonText}>
                    Reset to default
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.cardMeta}>
                Global defaults: {defaultPlan.plannedHours}h ·{" "}
                {defaultPlan.lunchEnabled
                  ? `${defaultPlan.lunchMinutes}m lunch`
                  : "no lunch"}{" "}
                · {money(defaultPlan.hourlyRate, preferences.currency)}/hr
              </Text>
              <Text style={styles.cardMeta}>
                Reset for {currentJob?.name ?? "this shift"}:{" "}
                {defaultTodayPlan.plannedHours}h ·{" "}
                {defaultTodayPlan.lunchEnabled
                  ? `${defaultTodayPlan.lunchMinutes}m lunch`
                  : "no lunch"}{" "}
                · {money(defaultTodayPlan.hourlyRate, currency)}/hr · OT after{" "}
                {defaultTodayPlan.overtimeThreshold}h ×{" "}
                {defaultTodayPlan.overtimeMultiplier}.
              </Text>
              <Text style={styles.cardMeta}>
                Reset uses global work hours plus this job's rate and any
                lunch/overtime overrides. Change job-specific rules in Jobs.
              </Text>
              {currency !== preferences.currency && (
                <Text style={styles.cardMeta}>
                  This shift uses {currency}, while global defaults use{" "}
                  {preferences.currency}. Save global defaults is unavailable to
                  avoid mixing currencies. Global workday settings can be edited
                  in Settings.
                </Text>
              )}
            </View>
          </Section>
          <Section title="Reminders" subtitle="Lunch & return-to-work alerts">
            <Text style={styles.cardMeta}>
              {working
                ? `${reminderSchedule.length} reminder rule(s) set for this shift. Phone notifications: ${notificationPermission === "granted" ? "allowed" : notificationPermission === "denied" ? "off — enable in device settings" : "permission not requested"}.`
                : "Clock in to start this job's reminders."}
            </Text>
            {reminderSchedule.map((item) => (
              <Text key={item.key} style={styles.cardMeta}>
                {item.name} · {timeLabel(new Date(item.at).toISOString())}
              </Text>
            ))}
            <Text style={styles.cardMeta}>
              {currentJob?.reminderSettings
                ? `Job settings for ${currentJob.name}. Changes here are saved to this job and also appear in Jobs.`
                : "Tracking-session overrides based on global defaults. Changes here do not rewrite global defaults; edit those in Settings."}
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
              label="Reminder after clock-in (minutes)"
              allowEmpty
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
              label="Show pop-up reminders"
              enabled={reminders.reminderOverlay}
              onPress={() =>
                onRemindersChange({
                  reminderOverlay: !reminders.reminderOverlay,
                })
              }
            />
            <ToggleRow
              label="Play reminder sound"
              enabled={reminders.reminderSound}
              onPress={() =>
                onRemindersChange({ reminderSound: !reminders.reminderSound })
              }
            />
            <ToggleRow
              label="Show in-app reminder banner"
              enabled={reminders.reminderTabFlash}
              onPress={() =>
                onRemindersChange({
                  reminderTabFlash: !reminders.reminderTabFlash,
                })
              }
            />
            <Text style={styles.cardMeta}>
              Job-specific reminder rules are managed in Jobs. Basic lunch and
              return reminders remain available on Free.
            </Text>
          </Section>
          <Section
            title="Hours Calculator"
            subtitle="Calculate pay from manual times or paid hours"
          >
            {canCalculate ? (
              <Calculator
                shift={activeShift}
                defaults={defaultPlan}
                jobs={allJobs}
                deductions={deductions}
                currency={preferences.currency}
                payVisible={payVisible}
              />
            ) : (
              <PaywallCard
                onPress={onPremium}
                title="Hours Calculator"
                description="Preview Premium to explore work hours, start/end times and estimated earnings."
              />
            )}
          </Section>
          {!canCalculate && (
            <PaywallCard
              onPress={onPremium}
              title="Explore Premium"
              description="Add more jobs, unlock full History and advanced Pay tools. Basic tracking and reminders stay available on Free."
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      {editingShift && preferences.enableManualEditing && (
        <EditTimesModal
          key={editingShift.id}
          shift={editingShift}
          jobName={allJobs.find((job) => job.id === editingShift.jobId)?.name}
          busy={busy}
          onSave={(times) => onEditTimes(editingShift.id, times)}
          onClose={() => setEditingShiftId(null)}
        />
      )}
    </SafeAreaView>
  );
}
