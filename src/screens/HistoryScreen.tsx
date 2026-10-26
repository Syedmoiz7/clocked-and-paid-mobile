import { entitlementsFor } from "../services/entitlements";
import { useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { AppState, Shift } from "../types";
import { useThemeTokens } from "../providers/ThemeProvider";
import { useClockFormat } from "../features/settings/useClockFormat";
import {
  Action,
  Choices,
  DateField,
  Toggle,
} from "../features/history/EntryForm";
import { CalendarView } from "../features/history/CalendarView";
import { EntryModal } from "../features/history/EntryModal";
import {
  canResume,
  entryCurrency,
  historySummary,
  visibleHistory,
} from "../features/history/summary";
import { PaywallCard } from "../components/PaywallCard";
import {
  blankDraft,
  defaultFilters,
  draftForEntry,
  duration,
  entitledEntries,
  localDate,
  money,
  paymentStatus,
  selectable,
  validDate,
  wagesFor,
  workedMinutes,
  type EntryDraft,
  type HistoryFilters,
} from "../features/history/model";
type Props = {
  data: AppState;
  busy: boolean;
  onSave: (draft: EntryDraft, id?: string) => Promise<string | null>;
  onDelete: (id: string) => void;
  onPaid: (id: string) => void;
  onBulkPaid: (ids: string[]) => Promise<boolean>;
  onExport: (entries: Shift[]) => void;
  onPayVisibility: (visible: boolean) => void;
  onOpenTracker: () => void;
  onReactivate: (id: string) => void;
  onPremium: () => void;
  onEndPreview: () => void;
};
const periodOptions = [
  { value: "all", label: "All time" },
  { value: "week", label: "This week" },
  { value: "lastWeek", label: "Last week" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
  { value: "custom", label: "Custom" },
];
export function HistoryScreen({
  data,
  busy,
  onSave,
  onDelete,
  onPaid,
  onBulkPaid,
  onExport,
  onPayVisibility,
  onOpenTracker,
  onReactivate,
  onPremium,
  onEndPreview,
}: Props) {
  const { colors, styles } = useThemeTokens();
  const premium = entitlementsFor(data).fullHistory;
  const { timeLabel: displayTime } = useClockFormat();
  const {
    history,
    activeShift,
    jobs,
    paychecks,
    defaultPlan: plan,
    payVisible,
  } = data;
  const [filters, setFilters] = useState(defaultFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView] = useState("list");
  const [form, setForm] = useState<{
    draft: EntryDraft;
    id?: string;
  } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(
      () => setNow(Date.now()),
      activeShift || data.extraShifts.length ? 1000 : 30000,
    );
    return () => clearInterval(timer);
  }, [activeShift, data.extraShifts.length]);
  const update = (changes: Partial<HistoryFilters>) => {
    setSelected([]);
    setFilters((current) => ({ ...current, ...changes }));
  };
  const { entries, live } = visibleHistory(data, filters, premium, now);
  const totals = historySummary(entries, data, live, now);
  const eligible = entries
    .filter((entry) => selectable(entry, paychecks, jobs))
    .map((entry) => entry.id);
  const selectedEligible = selected.filter((id) => eligible.includes(id));
  const currency =
    jobs.find((job) => job.id === filters.jobId)?.currency ??
    data.preferences.currency;
  const amount = (value: number, code = currency) =>
    payVisible ? money(value, code) : "•••••";
  const activeFilterCount = [
    filters.jobId !== null,
    filters.unpaidOnly,
    filters.type !== "all",
    filters.earnings !== "all",
    filters.excludeTips,
    filters.excludeDeductions,
  ].filter(Boolean).length;
  const clearFilters = () => {
    setFilters(defaultFilters());
    setSelected([]);
  };
  const toggleSelected = (id: string) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  const confirmBulk = () =>
    Alert.alert(
      "Mark selected shifts as paid?",
      `${selectedEligible.length} selected shift(s) will be marked paid.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: () => {
            void onBulkPaid(selectedEligible).then((saved) => {
              if (saved) {
                setSelected([]);
                setSelectionMode(false);
              }
            });
          },
        },
      ],
    );
  const totalLabel =
    filters.earnings === "tips"
      ? "Total Tips"
      : filters.earnings === "net" && !filters.excludeDeductions
        ? "Estimated Net"
        : filters.excludeTips
          ? "Wages Only"
          : "Total Earned";
  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Work History</Text>
        <Text style={styles.subtitle}>
          {
            entitledEntries(history, premium).filter(
              (entry) => entry.entryType !== "project",
            ).length
          }{" "}
          shifts ·{" "}
          {
            entitledEntries(history, premium).filter(
              (entry) => entry.entryType === "project",
            ).length
          }{" "}
          projects{!premium ? " · This month" : ""}
        </Text>
        <Toggle
          title="Show Pay"
          value={payVisible}
          onChange={onPayVisibility}
        />
        <Choices
          options={[
            { value: "list", label: "List" },
            { value: "calendar", label: "Calendar" },
          ]}
          value={view}
          onChange={(value) => {
            setView(value);
            setForm(null);
            setSelectionMode(false);
            setSelected([]);
          }}
        />
        {premium && (
          <Action title="End Premium preview" onPress={onEndPreview} />
        )}
        {!premium && view === "calendar" && (
          <PaywallCard
            title="Full History & Calendar"
            description="Premium adds older entries, calendar views, summaries, and export."
            onPress={onPremium}
          />
        )}
        {view === "calendar" ? (
          <>
            {premium && (
              <CalendarView
                data={data}
                onEdit={(entry) =>
                  setForm({ id: entry.id, draft: draftForEntry(entry) })
                }
              />
            )}
          </>
        ) : (
          <>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Action
                  title="+ Add Shift"
                  onPress={() =>
                    setForm({
                      draft: {
                        ...blankDraft("shift"),
                        currency: data.preferences.currency,
                      },
                    })
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Action
                  title="+ Add Project"
                  onPress={() =>
                    setForm({
                      draft: {
                        ...blankDraft("project"),
                        currency: data.preferences.currency,
                      },
                    })
                  }
                />
              </View>
            </View>
            <Action
              title={selectionMode ? "Done selecting" : "Select shifts"}
              onPress={() => {
                setSelectionMode((current) => !current);
                setSelected([]);
              }}
            />
            <Choices
              options={periodOptions}
              value={filters.period}
              onChange={(period) =>
                update({ period: period as HistoryFilters["period"] })
              }
            />
            <Action
              title={`${showFilters ? "Hide" : "More"} filters${activeFilterCount ? ` (${activeFilterCount})` : ""}`}
              onPress={() => setShowFilters((current) => !current)}
            />
            {filters.period === "custom" && (
              <View style={styles.card}>
                <DateField
                  label="From"
                  value={filters.from}
                  onChange={(from) => update({ from })}
                />
                <DateField
                  label="To"
                  value={filters.to}
                  onChange={(to) => update({ to })}
                />
                {(!validDate(filters.from) ||
                  !validDate(filters.to) ||
                  filters.from > filters.to) && (
                  <Text style={[styles.cardMeta, { color: colors.warning }]}>
                    Select a valid date range.
                  </Text>
                )}
              </View>
            )}
            {showFilters && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Entry Filters</Text>
                <Text style={styles.cardMeta}>Job</Text>
                <Choices
                  options={[
                    { value: "", label: "All jobs" },
                    ...jobs.map((job) => ({ value: job.id, label: job.name })),
                  ]}
                  value={filters.jobId ?? ""}
                  onChange={(jobId) => update({ jobId: jobId || null })}
                />
                <Choices
                  options={[
                    { value: "all", label: "All entries" },
                    { value: "shifts", label: "Shifts only" },
                    { value: "projects", label: "Projects only" },
                  ]}
                  value={filters.type}
                  onChange={(type) =>
                    update({ type: type as HistoryFilters["type"] })
                  }
                />
                <Toggle
                  title="Unpaid only"
                  value={filters.unpaidOnly}
                  onChange={(unpaidOnly) => update({ unpaidOnly })}
                />
                <Text style={[styles.cardTitle, { marginTop: 15 }]}>
                  Earnings View
                </Text>
                <Choices
                  options={[
                    { value: "all", label: "Gross" },
                    { value: "net", label: "Net" },
                    { value: "tips", label: "Tips Only" },
                  ]}
                  value={filters.earnings}
                  onChange={(earnings) =>
                    update({
                      earnings: earnings as HistoryFilters["earnings"],
                      excludeTips: false,
                      excludeDeductions: false,
                    })
                  }
                />
                {filters.earnings !== "tips" && (
                  <>
                    <Toggle
                      title="Exclude tips"
                      value={filters.excludeTips}
                      onChange={(excludeTips) => update({ excludeTips })}
                    />
                  </>
                )}
                <Action title="Clear all filters" onPress={clearFilters} />
              </View>
            )}
            {(entries.length > 0 || live.length > 0) && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{totalLabel}</Text>
                {totals.map((total) => (
                  <View key={total.currency}>
                    <Text
                      style={{
                        color: colors.accent,
                        fontSize: 28,
                        fontWeight: "800",
                        marginTop: 12,
                      }}
                    >
                      {total.currency}{" "}
                      {amount(
                        filters.earnings === "tips"
                          ? total.tips
                          : Math.max(
                              0,
                              total.wages +
                                (filters.excludeTips ? 0 : total.tips) -
                                (filters.earnings === "net"
                                  ? total.deductions
                                  : 0),
                            ),
                        total.currency,
                      )}
                    </Text>
                    {payVisible && (
                      <Text style={styles.cardMeta}>
                        Wages {amount(total.wages, total.currency)} · Tips{" "}
                        {amount(total.tips, total.currency)}
                        {filters.excludeTips ? " (excluded)" : ""}
                        {filters.earnings === "net"
                          ? ` · Estimated deductions ${amount(total.deductions, total.currency)}`
                          : ""}
                      </Text>
                    )}
                  </View>
                ))}
                <Text style={styles.cardMeta}>
                  {duration(
                    totals.reduce((sum, total) => sum + total.minutes, 0),
                  )}{" "}
                  · {entries.length} saved entries
                  {live.length ? ` + ${live.length} live` : ""}
                </Text>
                {filters.earnings === "net" && (
                  <Text style={styles.cardMeta}>
                    Estimate from saved deductions for the shown entries,
                    prorated by date as in Pay. Actual take-home is recorded in
                    Pay.
                  </Text>
                )}
                {totals.length > 1 && (
                  <Text style={styles.cardMeta}>
                    Currencies are shown separately; no conversion is applied.
                  </Text>
                )}
              </View>
            )}
            {selectionMode && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  {selectedEligible.length} selected
                </Text>
                <Action
                  title="Select all unpaid shifts"
                  onPress={() => setSelected(eligible)}
                />
                <Action
                  title="Clear selection"
                  onPress={() => setSelected([])}
                />
                <Action
                  title={`Mark ${selectedEligible.length} as paid`}
                  disabled={busy || !selectedEligible.length}
                  onPress={confirmBulk}
                />
              </View>
            )}
            {live.map((shift) => (
              <View
                key={shift.id}
                style={[styles.card, { borderColor: colors.accent }]}
              >
                <Text style={[styles.cardTitle, { color: colors.accent }]}>
                  Live ·{" "}
                  {jobs.find((job) => job.id === shift.jobId)?.name ??
                    "Active shift"}
                </Text>
                <Text style={styles.cardMeta}>
                  In at {displayTime(shift.startedAt)} ·{" "}
                  {liveDuration(workedMinutes(shift, now))} worked
                </Text>
                <Text style={styles.cardMeta}>
                  {amount(
                    wagesFor(
                      shift,
                      jobs,
                      shift.id === activeShift?.id ? data.todayPlan : plan,
                      now,
                    ),
                    entryCurrency(shift, data),
                  )}{" "}
                  accruing
                </Text>
                <Action title="Open Tracker →" onPress={onOpenTracker} />
              </View>
            ))}
            {entries.length === 0 && !live.length && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  {activeFilterCount || filters.period !== "all"
                    ? "No matching entries"
                    : "No history yet"}
                </Text>
                <Text style={styles.cardMeta}>
                  Record a shift or add a past shift or flat-rate project.
                </Text>
                {(activeFilterCount > 0 || filters.period !== "all") && (
                  <Action title="Clear all filters" onPress={clearFilters} />
                )}
              </View>
            )}
            {entries.map((entry) => {
              const project = entry.entryType === "project";
              const open = expanded === entry.id;
              const status = paymentStatus(entry, paychecks, jobs);
              const job = jobs.find((job) => job.id === entry.jobId);
              const eligibleEntry = selectable(entry, paychecks, jobs);
              return (
                <View
                  key={entry.id}
                  style={[
                    styles.card,
                    selectedEligible.includes(entry.id) && {
                      borderColor: colors.accent,
                    },
                  ]}
                >
                  <Action
                    title={`${project ? entry.projectName || "Project" : entry.date} ${open ? "▴" : "▾"}`}
                    onPress={() => setExpanded(open ? null : entry.id)}
                  />
                  <Text
                    style={[
                      styles.cardTitle,
                      {
                        color: project ? colors.blue : colors.accent,
                        marginTop: 12,
                      },
                    ]}
                  >
                    {amount(
                      wagesFor(entry, jobs, plan) +
                        (project ? 0 : (entry.tips ?? 0)),
                      entry.currency ??
                        job?.currency ??
                        data.preferences.currency,
                    )}
                  </Text>
                  <Text style={styles.cardMeta}>
                    {project
                      ? `${entry.date} → ${entry.endDate ?? entry.date}`
                      : `${entry.missingClockIn ? "Missing Clock In" : displayTime(entry.startedAt)} → ${entry.endedAt ? displayTime(entry.endedAt) : "Unfinished"} · ${duration(workedMinutes(entry))}`}
                  </Text>
                  <Text
                    style={[
                      styles.cardMeta,
                      {
                        color: status.startsWith("Paid")
                          ? colors.accent
                          : colors.warning,
                      },
                    ]}
                  >
                    {status}
                    {job ? ` · ${job.name}` : ""}
                  </Text>
                  {selectionMode && (
                    <Action
                      title={
                        selectedEligible.includes(entry.id)
                          ? "✓ Selected"
                          : "Select"
                      }
                      disabled={!eligibleEntry}
                      onPress={() => toggleSelected(entry.id)}
                    />
                  )}
                  {open && (
                    <>
                      <Text style={styles.cardMeta}>
                        {project
                          ? `Currency: ${entry.currency ?? data.preferences.currency}`
                          : `Lunch: ${entry.lunchMinutes}m (${entry.lunchPaid ? "paid" : "unpaid"}) · Breaks: ${entry.breakMinutes}m${entry.breakLabel ? ` · ${entry.breakLabel}` : ""}`}
                      </Text>
                      {!project && (
                        <Text style={styles.cardMeta}>
                          Tips:{" "}
                          {amount(
                            entry.tips ?? 0,
                            entry.currency ??
                              job?.currency ??
                              data.preferences.currency,
                          )}{" "}
                          ·{" "}
                          {entry.tipType === "paycheck"
                            ? "On Paycheck"
                            : (entry.tipType ?? "cash")}
                        </Text>
                      )}
                      {entry.projectNotes && (
                        <Text style={styles.cardMeta}>
                          Notes: {entry.projectNotes}
                        </Text>
                      )}
                      <Action
                        title="Edit"
                        disabled={busy}
                        onPress={() =>
                          setForm({ id: entry.id, draft: draftForEntry(entry) })
                        }
                      />
                      <Action
                        title={entry.paid ? "Mark unpaid" : "Mark paid"}
                        disabled={
                          busy ||
                          status === "Paid via Paycheck" ||
                          status === "Incomplete"
                        }
                        onPress={() => onPaid(entry.id)}
                      />
                      {!project &&
                        !entry.missingClockIn &&
                        !entry.endedAt &&
                        entry.date === localDate() && (
                          <Action
                            title="Resume in Tracker"
                            disabled={busy || !canResume(entry, data, now)}
                            onPress={() => onReactivate(entry.id)}
                          />
                        )}
                      <Action
                        title="Delete"
                        disabled={busy}
                        onPress={() =>
                          Alert.alert(
                            "Delete entry?",
                            "This removes the entry from History and recalculates Tracker and Pay estimates. Saved paycheck receipts remain unchanged.",
                            [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Delete",
                                style: "destructive",
                                onPress: () => onDelete(entry.id),
                              },
                            ],
                          )
                        }
                      />
                    </>
                  )}
                </View>
              );
            })}
            <Action
              title={
                premium
                  ? "Export filtered history (CSV)"
                  : "Export CSV · Premium"
              }
              disabled={premium && !entries.length}
              onPress={() => (premium ? onExport(entries) : onPremium())}
            />
            <Text style={styles.cardMeta}>
              CSV includes the shown saved entries. Running shifts are excluded.
            </Text>
            {!premium && (
              <PaywallCard
                title="Full History & Calendar"
                description="Free includes this month’s history. Preview Premium for older entries, calendar views, summaries, and export."
                onPress={onPremium}
              />
            )}
          </>
        )}
      </ScrollView>
      {form && (
        <EntryModal
          key={form.id ?? form.draft.entryType}
          initial={form.draft}
          id={form.id}
          data={data}
          onSave={onSave}
          onClose={() => setForm(null)}
        />
      )}
    </SafeAreaView>
  );
}
function liveDuration(minutes: number) {
  const seconds = Math.floor(minutes * 60);
  return `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
