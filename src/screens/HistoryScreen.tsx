import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { AppState, Shift } from "../types";
import { useThemeTokens } from "../providers/ThemeProvider";
import { useClockFormat } from "../features/settings/useClockFormat";
import {
  Action,
  Choices,
  DateField,
  EntryForm,
  Toggle,
} from "../features/history/EntryForm";
import { CalendarView } from "../features/history/CalendarView";
import { PaywallCard } from "../components/PaywallCard";
import {
  blankDraft,
  defaultFilters,
  draftForEntry,
  duration,
  entitledEntries,
  filterEntries,
  localDate,
  money,
  paymentStatus,
  periodDeductions,
  selectable,
  validDate,
  wagesFor,
  workedMinutes,
  type EntryDraft,
  type HistoryFilters,
} from "../features/history/model";
type Props = {
  data: AppState;
  onSave: (draft: EntryDraft, id?: string) => string | null;
  onDelete: (id: string) => void;
  onPaid: (id: string) => void;
  onBulkPaid: (ids: string[]) => void;
  onExport: (entries: Shift[]) => void;
  onPayVisibility: (visible: boolean) => void;
  onOpenTracker: () => void;
  onDiscard: () => void;
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
  onSave,
  onDelete,
  onPaid,
  onBulkPaid,
  onExport,
  onPayVisibility,
  onOpenTracker,
  onDiscard,
  onReactivate,
  onPremium,
  onEndPreview,
}: Props) {
  const { colors, styles } = useThemeTokens();
  const { timeLabel: displayTime } = useClockFormat();
  const {
    history,
    activeShift,
    jobs,
    paychecks,
    deductions,
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
    if (!activeShift) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [activeShift]);
  const update = (changes: Partial<HistoryFilters>) =>
    setFilters((current) => ({ ...current, ...changes }));
  const filtered = useMemo(
    () => filterEntries(history, filters, activeShift?.id),
    [history, filters, activeShift?.id],
  );
  const entries = entitledEntries(filtered, data.isPremium);
  const eligible = entries
    .filter((entry) => selectable(entry, paychecks, jobs))
    .map((entry) => entry.id);
  const selectedEligible = selected.filter((id) => eligible.includes(id));
  const liveMinutes = activeShift ? workedMinutes(activeShift, now) : 0;
  const livePay = activeShift
    ? wagesFor(activeShift, jobs, data.todayPlan, now)
    : 0;
  const minutes =
    entries.reduce((sum, entry) => sum + workedMinutes(entry), 0) + liveMinutes;
  const wages =
    entries.reduce((sum, entry) => sum + wagesFor(entry, jobs, plan), 0) +
    livePay;
  const tips = entries.reduce(
    (sum, entry) =>
      sum + (entry.entryType === "project" ? 0 : (entry.tips ?? 0)),
    0,
  );
  const deductionsTotal = periodDeductions(deductions, entries, filters.jobId);
  const gross = wages + (filters.excludeTips ? 0 : tips);
  const total =
    filters.earnings === "tips"
      ? tips
      : filters.earnings === "net"
        ? gross - (filters.excludeDeductions ? 0 : deductionsTotal)
        : gross;
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
  const clearFilters = () => setFilters(defaultFilters());
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
            onBulkPaid(selectedEligible);
            setSelected([]);
            setSelectionMode(false);
          },
        },
      ],
    );
  const totalLabel =
    filters.earnings === "tips"
      ? "Total Tips"
      : filters.earnings === "net" && !filters.excludeDeductions
        ? "Net Earnings"
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
          {history.filter((entry) => entry.entryType !== "project").length}{" "}
          shifts ·{" "}
          {history.filter((entry) => entry.entryType === "project").length}{" "}
          projects{activeShift ? " · 1 active" : ""}
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
        {data.isPremium && (
          <Action title="End Premium preview" onPress={onEndPreview} />
        )}
        {!data.isPremium && view === "calendar" && (
          <PaywallCard
            title="Full History & Calendar"
            description="Premium adds older entries, calendar views, summaries, and export."
            onPress={onPremium}
          />
        )}
        {view === "calendar" ? (
          <>
            {data.isPremium && (
              <CalendarView
                data={data}
                onEdit={(entry) =>
                  setForm({ id: entry.id, draft: draftForEntry(entry) })
                }
              />
            )}
            {form && (
              <EntryForm
                key={form.id}
                initial={form.draft}
                editing
                jobs={jobs}
                onCancel={() => setForm(null)}
                onSave={(draft) => {
                  const error = onSave(draft, form.id);
                  if (!error) setForm(null);
                  return error;
                }}
              />
            )}
          </>
        ) : (
          <>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Action
                  title="+ Add Shift"
                  onPress={() => setForm({ draft: blankDraft("shift") })}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Action
                  title="+ Add Project"
                  onPress={() => setForm({ draft: blankDraft("project") })}
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
                    update({ earnings: earnings as HistoryFilters["earnings"] })
                  }
                />
                {filters.earnings !== "tips" && (
                  <>
                    <Toggle
                      title="Exclude tips"
                      value={filters.excludeTips}
                      onChange={(excludeTips) => update({ excludeTips })}
                    />
                    {filters.earnings === "net" && (
                      <Toggle
                        title="Exclude deductions"
                        value={filters.excludeDeductions}
                        onChange={(excludeDeductions) =>
                          update({ excludeDeductions })
                        }
                      />
                    )}
                  </>
                )}
                <Action title="Clear all filters" onPress={clearFilters} />
              </View>
            )}
            {(entries.length > 0 || activeShift) && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{totalLabel}</Text>
                <Text
                  style={{
                    color: colors.accent,
                    fontSize: 30,
                    fontWeight: "800",
                    marginTop: 12,
                  }}
                >
                  {amount(total)}
                </Text>
                <Text style={styles.cardMeta}>
                  {duration(minutes)} · {entries.length + (activeShift ? 1 : 0)}{" "}
                  entries
                </Text>
                {activeFilterCount > 0 && payVisible && (
                  <>
                    <Text style={styles.cardMeta}>Wages: {amount(wages)}</Text>
                    <Text style={styles.cardMeta}>
                      Tips: {amount(tips)}
                      {filters.excludeTips ? " (excluded)" : ""}
                    </Text>
                    <Text style={styles.cardMeta}>
                      Deductions: {amount(deductionsTotal)}
                      {filters.earnings !== "net" || filters.excludeDeductions
                        ? " (excluded)"
                        : ""}
                    </Text>
                  </>
                )}
              </View>
            )}
            {form && (
              <EntryForm
                key={form.id ?? form.draft.entryType}
                initial={form.draft}
                editing={Boolean(form.id)}
                jobs={jobs}
                existingDates={history.map((entry) => entry.date)}
                onCancel={() => setForm(null)}
                onSave={(draft) => {
                  const error = onSave(draft, form.id);
                  if (!error) setForm(null);
                  return error;
                }}
              />
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
                  disabled={!selectedEligible.length}
                  onPress={confirmBulk}
                />
              </View>
            )}
            {activeShift && (
              <View style={[styles.card, { borderColor: colors.accent }]}>
                <Text style={[styles.cardTitle, { color: colors.accent }]}>
                  Live · Active shift
                </Text>
                <Text style={styles.cardMeta}>
                  In at {displayTime(activeShift.startedAt)} ·{" "}
                  {liveDuration(liveMinutes)} worked
                </Text>
                <Text style={styles.cardMeta}>
                  {amount(
                    livePay,
                    jobs.find((job) => job.id === activeShift.jobId)
                      ?.currency ?? data.preferences.currency,
                  )}{" "}
                  accruing
                </Text>
                <Action title="Open Tracker →" onPress={onOpenTracker} />
                <Action
                  title="Discard shift"
                  onPress={() =>
                    Alert.alert(
                      "Discard active shift?",
                      "This removes the current shift and its reminders.",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Discard",
                          style: "destructive",
                          onPress: onDiscard,
                        },
                      ],
                    )
                  }
                />
              </View>
            )}
            {entries.length === 0 && !form && !activeShift && (
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
                        onPress={() =>
                          setForm({ id: entry.id, draft: draftForEntry(entry) })
                        }
                      />
                      <Action
                        title={entry.paid ? "Mark unpaid" : "Mark paid"}
                        disabled={status === "Paid via Paycheck"}
                        onPress={() => onPaid(entry.id)}
                      />
                      {!project &&
                        !entry.missingClockIn &&
                        !entry.endedAt &&
                        entry.date === localDate() && (
                          <Action
                            title="Resume in Tracker"
                            disabled={Boolean(activeShift)}
                            onPress={() => onReactivate(entry.id)}
                          />
                        )}
                      <Action
                        title="Delete"
                        onPress={() =>
                          Alert.alert(
                            "Delete entry?",
                            "This entry will be removed from History.",
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
                data.isPremium
                  ? "Export filtered history (CSV)"
                  : "Export CSV · Premium"
              }
              disabled={data.isPremium && !entries.length}
              onPress={() => (data.isPremium ? onExport(entries) : onPremium())}
            />
            {!data.isPremium && (
              <PaywallCard
                title="Full History & Calendar"
                description="Free includes this month’s history. Preview Premium for older entries, calendar views, summaries, and export."
                onPress={onPremium}
              />
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
function liveDuration(minutes: number) {
  const seconds = Math.floor(minutes * 60);
  return `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
