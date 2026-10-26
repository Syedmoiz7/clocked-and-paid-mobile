import { useEffect, useState } from "react";
import { Keyboard, Text, View } from "react-native";
import { Action, Choices, Field, Toggle } from "../../components/FormControls";
import { TimePickerField } from "../../components/TimePickerField";
import { useThemeTokens } from "../../providers/ThemeProvider";
import { money, timeValue } from "../history/model";
import type { Deduction, MockJob, Shift, TodayPlan } from "../../types";
import { calculateHours, type CalculatorDraft } from "./model";
import {
  calculatorDefaults,
  calculatorPay,
  selectCalculatorHours,
  selectCalculatorTime,
  calculatorHourOptions,
} from "./calculatorLogic";

export function Calculator({
  shift,
  defaults,
  jobs,
  deductions,
  currency,
  payVisible,
}: {
  shift: Shift | null;
  defaults: TodayPlan;
  jobs: MockJob[];
  deductions: Deduction[];
  currency: string;
  payVisible: boolean;
}) {
  const { styles, colors } = useThemeTokens();
  const [draft, setDraft] = useState<CalculatorDraft>(() =>
    calculatorDefaults(defaults),
  );
  const [payMode, setPayMode] = useState("gross"),
    [scope, setScope] = useState("global"),
    [notice, setNotice] = useState("");
  useEffect(() => {
    if (
      scope !== "global" &&
      !jobs.some((job) => `job:${job.id}` === scope && !job.archived)
    )
      setScope("global");
  }, [jobs, scope]);
  const update = (changes: Partial<CalculatorDraft>) => {
    setDraft((value) => ({ ...value, ...changes }));
    setNotice("");
  };
  const result = calculateHours(draft);
  const valid = !("error" in result);
  const pay = valid
    ? calculatorPay(
        result.hours,
        defaults,
        jobs,
        deductions,
        currency,
        scope === "global" ? null : scope.slice(4),
      )
    : null;
  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.cardMeta}>
        Enter start and end times, or choose paid work hours below. Each method
        replaces the other.
      </Text>
      <Text style={styles.cardTitle}>Manual times</Text>
      <TimePickerField
        label="Start time"
        value={draft.start}
        onChange={(value) => {
          setDraft((previous) =>
            selectCalculatorTime(previous, "start", value),
          );
          setNotice("");
        }}
      />
      <TimePickerField
        label="End time"
        value={draft.end}
        onChange={(value) => {
          setDraft((previous) => selectCalculatorTime(previous, "end", value));
          setNotice("");
        }}
      />
      {shift && (
        <Action
          title="Use current shift's clock-in"
          onPress={() => {
            setDraft((previous) =>
              selectCalculatorTime(
                previous,
                "start",
                timeValue(shift.startedAt),
              ),
            );
            setNotice("");
          }}
        />
      )}
      <Text style={styles.cardTitle}>Or choose paid work hours</Text>
      <Choices
        value={draft.mode === "hours" ? draft.hours : ""}
        options={calculatorHourOptions(defaults.plannedHours).map((hours) => ({
          value: String(hours),
          label: `${hours}h`,
        }))}
        onChange={(hours) => {
          setDraft((previous) => selectCalculatorHours(previous, hours));
          setNotice("");
        }}
      />
      <Text style={[styles.cardMeta, { color: colors.accent }]}>
        {draft.mode === "times"
          ? "Using manual times · hour options are unselected"
          : "Using selected paid hours · manual times are cleared"}
      </Text>
      {draft.mode === "times" ? (
        <>
          <Toggle
            title="Deduct unpaid lunch"
            value={draft.lunchEnabled}
            onChange={(lunchEnabled) => update({ lunchEnabled })}
          />
          {draft.lunchEnabled && (
            <Field
              label="Lunch duration (whole minutes)"
              numeric
              value={draft.lunchMinutes}
              onChange={(lunchMinutes) => update({ lunchMinutes })}
            />
          )}
        </>
      ) : (
        <Text style={styles.cardMeta}>
          Selected hours are already paid work time. Lunch is not deducted
          again.
        </Text>
      )}
      <Text
        accessibilityLiveRegion="polite"
        style={{
          color: valid ? colors.accent : colors.warning,
          fontSize: 20,
          fontWeight: "800",
        }}
      >
        {"error" in result
          ? result.error
          : `${Math.floor(result.workMinutes / 60)}h ${result.workMinutes % 60}m paid work`}
      </Text>
      {valid && draft.mode === "times" && (
        <Text style={styles.cardMeta}>
          {result.lunchMinutes}m unpaid lunch deducted.
          {result.dayOffset ? " End time is on the next day." : ""}
        </Text>
      )}

      <Action
        title="Reset calculator"
        onPress={() => {
          Keyboard.dismiss();
          setDraft(calculatorDefaults(defaults));
          setScope("global");
          setPayMode("gross");
          setNotice(
            "Calculator reset from saved defaults. Today's Plan was not changed.",
          );
        }}
      />
      <Text style={styles.cardMeta}>Pay preview for</Text>
      <Choices
        value={scope}
        options={[
          { value: "global", label: "Global defaults" },
          ...jobs
            .filter((job) => !job.archived)
            .map((job) => ({ value: `job:${job.id}`, label: job.name })),
        ]}
        onChange={setScope}
      />
      <Choices
        value={payMode}
        options={[
          { value: "gross", label: "Gross" },
          { value: "net", label: "Estimated net" },
        ]}
        onChange={setPayMode}
      />

      {!payVisible && (
        <Text style={styles.cardMeta}>
          Pay is hidden. Use Show pay at the top of Tracker to reveal amounts.
        </Text>
      )}
      <Text style={styles.cardTitle}>
        {payMode === "net" ? "Estimated net" : "Estimated gross"}:{" "}
        {pay == null
          ? "—"
          : payVisible
            ? money(payMode === "net" ? pay.net : pay.gross, pay.currency)
            : "•••••"}
      </Text>
      {pay == null && (
        <Text style={styles.cardMeta}>
          Complete both manual times and lunch settings, or choose a paid-hours
          option, to see an earnings estimate.
        </Text>
      )}
      {pay && (
        <Text style={styles.cardMeta}>
          {payVisible ? money(pay.hourlyRate, pay.currency) : "•••••"}/hr · OT
          after {pay.overtimeThreshold}h × {pay.overtimeMultiplier}.{" "}
          {payMode === "net"
            ? "Includes today's applicable daily deductions only, not a full paycheck/tax estimate. Global flat deductions use the global currency."
            : "Before daily deductions."}{" "}
          Pay profiles are for this estimate only.
        </Text>
      )}
      {notice !== "" && (
        <Text accessibilityLiveRegion="polite" style={styles.cardMeta}>
          {notice}
        </Text>
      )}
    </View>
  );
}
