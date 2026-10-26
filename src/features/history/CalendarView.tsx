import { useState } from "react";
import { Text, View } from "react-native";
import type { AppState, Shift } from "../../types";
import { useThemeTokens } from "../../providers/ThemeProvider";
import { Action, Choices, DateField } from "./EntryForm";
import {
  duration,
  localDate,
  money,
  wagesFor,
  workedMinutes,
  validDate,
} from "./model";
import { entryCurrency, historySummary } from "./summary";
import { addDays, payPeriod } from "./payPeriods";
type Mode =
  "daily" | "weekly" | "monthly" | "yearly" | "payperiods" | "summary";
const modes = [
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "payperiods",
  "summary",
] as const;
export function CalendarView({
  data,
  onEdit,
}: {
  data: AppState;
  onEdit: (entry: Shift) => void;
}) {
  const { colors, styles } = useThemeTokens();
  const [mode, setMode] = useState<Mode>("monthly");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [day, setDay] = useState(localDate());
  const [jobId, setJobId] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [from, setFrom] = useState(`${localDate().slice(0, 7)}-01`);
  const [to, setTo] = useState(localDate());
  const history = data.history.filter(
    (entry) =>
      entry.id !== data.activeShift?.id &&
      !data.extraShifts.some((shift) => shift.id === entry.id) &&
      (!jobId || entry.jobId === jobId),
  );
  const currency =
    data.jobs.find((job) => job.id === jobId)?.currency ??
    data.preferences.currency;
  const amount = (value: number, code = currency) =>
    data.payVisible ? money(value, code) : "•••••";
  const summary = (entries: Shift[]) => {
    const gross =
      historySummary(entries, data)
        .map(
          (total) => `${total.currency} ${amount(total.gross, total.currency)}`,
        )
        .join(" · ") || "No earnings";
    const minutes = entries.reduce(
      (sum, entry) => sum + workedMinutes(entry),
      0,
    );
    return {
      gross,
      minutes,
      days: new Set(
        entries
          .filter((entry) => workedMinutes(entry) > 0)
          .map((entry) => entry.date),
      ).size,
    };
  };
  const inRange = (start: string, end: string) =>
    history.filter((entry) => entry.date >= start && entry.date <= end);
  const details = (entries: Shift[]) =>
    entries.map((entry) => (
      <Action
        key={entry.id}
        title={`${entry.date} · ${entry.entryType === "project" ? entry.projectName : duration(workedMinutes(entry))} · ${amount(wagesFor(entry, data.jobs, data.defaultPlan) + (entry.entryType === "project" ? 0 : (entry.tips ?? 0)), entryCurrency(entry, data))} — Edit`}
        onPress={() => onEdit(entry)}
      />
    ));
  const group = (key: string, label: string, entries: Shift[]) => {
    const totals = summary(entries);
    return (
      <View key={key} style={styles.card}>
        <Action
          title={`${label} ${expanded === key ? "▴" : "▾"}`}
          onPress={() => setExpanded(expanded === key ? null : key)}
        />
        <Text
          style={[styles.cardTitle, { color: colors.accent, marginTop: 10 }]}
        >
          {totals.gross}
        </Text>
        <Text style={styles.cardMeta}>
          {duration(totals.minutes)} · {totals.days} days worked ·{" "}
          {entries.length} entries
        </Text>
        {expanded === key &&
          (entries.length ? (
            details(entries)
          ) : (
            <Text style={styles.cardMeta}>No entries for this period.</Text>
          ))}
      </View>
    );
  };
  const shiftMonth = (offset: number) => {
    const value = new Date(year, month + offset, 1, 12);
    setMonth(value.getMonth());
    setYear(value.getFullYear());
    setDay(localDate(value));
    setExpanded(null);
  };
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const scheduledJobs = data.jobs.filter(
    (job) => job.payFrequency && job.payPeriodStart,
  );
  const selectedJob = scheduledJobs.find((job) => job.id === jobId);
  const periods = new Map<
    string,
    {
      start: string;
      end: string;
    }
  >();
  if (selectedJob)
    for (let i = 1; i <= new Date(year, month + 1, 0).getDate(); i++) {
      const period = payPeriod(
        `${monthPrefix}-${String(i).padStart(2, "0")}`,
        selectedJob,
      );
      if (period) periods.set(period.start, period);
    }
  return (
    <View>
      <Text style={[styles.cardTitle, { marginTop: 20 }]}>Pay Calendar</Text>
      <Text style={styles.cardMeta}>
        Saved entries only. Gross includes tips; running shifts are shown in
        Tracker and the History list.
      </Text>
      <Choices
        options={modes.map((value) => ({
          value,
          label:
            value === "payperiods"
              ? "Pay Periods"
              : value[0]!.toUpperCase() + value.slice(1),
        }))}
        value={mode}
        onChange={(value) => {
          setMode(value as Mode);
          setExpanded(null);
        }}
      />
      {mode === "payperiods" && !jobId && (
        <Text style={styles.cardMeta}>
          Choose a job above to see its pay periods.
        </Text>
      )}
      <Choices
        options={[
          { value: "", label: "All jobs" },
          ...data.jobs.map((job) => ({ value: job.id, label: job.name })),
        ]}
        value={jobId}
        onChange={setJobId}
      />
      {mode !== "summary" && (
        <View>
          <Text style={styles.cardMeta}>
            {mode === "daily" || mode === "payperiods"
              ? new Date(year, month, 1).toLocaleDateString([], {
                  year: "numeric",
                  month: "long",
                })
              : year}
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Action
                title="← Previous"
                onPress={() =>
                  mode === "daily" || mode === "payperiods"
                    ? shiftMonth(-1)
                    : setYear(year - 1)
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <Action
                title="Next →"
                onPress={() =>
                  mode === "daily" || mode === "payperiods"
                    ? shiftMonth(1)
                    : setYear(year + 1)
                }
              />
            </View>
          </View>
          <Action
            title="Today"
            onPress={() => {
              setYear(new Date().getFullYear());
              setMonth(new Date().getMonth());
              setDay(localDate());
            }}
          />
        </View>
      )}
      {mode === "daily" && (
        <>
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 10 }}
          >
            {["M", "T", "W", "T", "F", "S", "S"].map((label, index) => (
              <Text
                key={`label-${index}`}
                style={[
                  styles.cardMeta,
                  { width: "14.28%", textAlign: "center" },
                ]}
              >
                {label}
              </Text>
            ))}
            {Array.from(
              { length: (new Date(year, month, 1).getDay() + 6) % 7 },
              (_, index) => (
                <View key={`blank-${index}`} style={{ width: "14.28%" }} />
              ),
            )}
            {Array.from(
              { length: new Date(year, month + 1, 0).getDate() },
              (_, index) => {
                const date = `${monthPrefix}-${String(index + 1).padStart(2, "0")}`;
                return (
                  <View key={date} style={{ width: "14.28%", padding: 2 }}>
                    <Action
                      title={`${index + 1}${history.some((entry) => entry.date === date) ? " •" : ""}`}
                      onPress={() => setDay(date)}
                    />
                  </View>
                );
              },
            )}
          </View>
          {group(day, day, inRange(day, day))}
        </>
      )}
      {mode === "weekly" &&
        (() => {
          const first = new Date(year, 0, 1, 12);
          first.setDate(first.getDate() - ((first.getDay() + 6) % 7));
          return Array.from({ length: 54 }, (_, index) => {
            const start = addDays(localDate(first), index * 7);
            const end = addDays(start, 6);
            return start <= `${year}-12-31` && end >= `${year}-01-01`
              ? group(start, `${start} → ${end}`, inRange(start, end))
              : null;
          });
        })()}
      {mode === "monthly" &&
        Array.from({ length: 12 }, (_, index) => {
          const start = `${year}-${String(index + 1).padStart(2, "0")}-01`;
          const end = localDate(new Date(year, index + 1, 0, 12));
          return group(
            start,
            new Date(year, index, 1).toLocaleDateString([], { month: "long" }),
            inRange(start, end),
          );
        })}
      {mode === "yearly" &&
        [
          ...new Set([
            year,
            ...history.map((entry) => Number(entry.date.slice(0, 4))),
          ]),
        ]
          .sort((a, b) => b - a)
          .map((value) => (
            <View key={value}>
              {group(
                String(value),
                String(value),
                inRange(`${value}-01-01`, `${value}-12-31`),
              )}
              {expanded === String(value) && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Month breakdown</Text>
                  {Array.from({ length: 12 }, (_, index) => {
                    const prefix = `${value}-${String(index + 1).padStart(2, "0")}`;
                    const totals = summary(
                      history.filter((entry) => entry.date.startsWith(prefix)),
                    );
                    return (
                      <Text key={prefix} style={styles.cardMeta}>
                        {new Date(value, index, 1).toLocaleDateString([], {
                          month: "short",
                        })}{" "}
                        · {totals.gross} · {duration(totals.minutes)} ·{" "}
                        {totals.days} days
                      </Text>
                    );
                  })}
                </View>
              )}
            </View>
          ))}
      {mode === "payperiods" &&
        (selectedJob ? (
          <>
            <Text style={styles.cardMeta}>
              {selectedJob.name} · {selectedJob.payFrequency}
            </Text>
            {[...periods.values()].map((period) =>
              group(
                period.start,
                `${period.start} → ${period.end}`,
                data.history.filter(
                  (entry) =>
                    entry.id !== data.activeShift?.id &&
                    entry.jobId === selectedJob.id &&
                    entry.date >= period.start &&
                    entry.date <= period.end,
                ),
              ),
            )}
          </>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {jobId ? "No pay schedule for this job" : "Choose a job"}
            </Text>
            <Text style={styles.cardMeta}>
              Set a job’s pay frequency and anchor date in Jobs to see its pay
              periods.
            </Text>
          </View>
        ))}
      {mode === "summary" && (
        <>
          <DateField label="From" value={from} onChange={setFrom} />
          <DateField label="To" value={to} onChange={setTo} />
          {!validDate(from) || !validDate(to) || from > to ? (
            <Text style={[styles.cardMeta, { color: colors.warning }]}>
              Select a valid date range.
            </Text>
          ) : (
            <>
              {group("summary", `${from} → ${to}`, inRange(from, to))}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Earnings breakdown</Text>
                {historySummary(inRange(from, to), data).map((total) => (
                  <Text key={total.currency} style={styles.cardMeta}>
                    {total.currency} · Estimated deductions{" "}
                    {amount(total.deductions, total.currency)} · Estimated net{" "}
                    {amount(total.net, total.currency)}
                  </Text>
                ))}
                <Text style={styles.cardMeta}>
                  Saved deductions are prorated by date as in Pay. Actual
                  take-home is recorded in Pay.
                </Text>
              </View>
              {[
                ...new Set(inRange(from, to).map((entry) => entry.jobId ?? "")),
              ].map((id) =>
                group(
                  `job-${id}`,
                  data.jobs.find((job) => job.id === id)?.name ??
                    "No job assigned",
                  inRange(from, to).filter(
                    (entry) => (entry.jobId ?? "") === id,
                  ),
                ),
              )}
            </>
          )}
        </>
      )}
    </View>
  );
}
