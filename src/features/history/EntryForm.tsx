import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { TimePickerField } from "../../components/TimePickerField";
import {
  Action,
  Choices,
  DateField,
  Field,
  Toggle,
} from "../../components/FormControls";
export {
  Action,
  Choices,
  DateField,
  Field,
  Toggle,
} from "../../components/FormControls";
import { useThemeTokens } from "../../providers/ThemeProvider";
import type { MockJob, TodayPlan, Shift } from "../../types";
import { useClockFormat } from "../settings/useClockFormat";
import {
  currencies,
  duration,
  money,
  prepareEntry,
  workedMinutes,
  type EntryDraft,
} from "./model";
function OptionalTime({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { colors, styles } = useThemeTokens();
  return (
    <View style={{ marginTop: 12 }}>
      <TimePickerField label={label} value={value} onChange={onChange} />
      {value && (
        <Pressable accessibilityRole="button" onPress={() => onChange("")}>
          <Text style={{ color: colors.accent, paddingVertical: 8 }}>
            Clear {label.toLowerCase()}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
export function EntryForm({
  initial,
  jobs,
  existingDates = [],
  editing = false,
  existing,
  plan,
  defaultCurrency,
  payVisible,
  busy = false,
  paymentLocked = false,
  onSave,
}: {
  initial: EntryDraft;
  jobs: MockJob[];
  existingDates?: string[];
  editing?: boolean;
  existing?: Shift;
  plan: TodayPlan;
  defaultCurrency: string;
  payVisible: boolean;
  busy?: boolean;
  paymentLocked?: boolean;
  onSave: (draft: EntryDraft) => Promise<string | null>;
}) {
  const { colors, styles } = useThemeTokens();
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [lunchMode, setLunchMode] = useState(
    initial.lunchStart || initial.lunchEnd ? "times" : "minutes",
  );
  const { timeLabel } = useClockFormat();
  const update = (changes: Partial<EntryDraft>) => {
    if (busy) return;
    setError(null);
    setDraft((current) => ({ ...current, ...changes }));
  };
  const project = draft.entryType === "project";
  const complete = project || Boolean(draft.start && draft.end);
  const preview = prepareEntry(draft, jobs, plan, existing, defaultCurrency);
  return (
    <View style={styles.card}>
      <View
        pointerEvents={busy ? "none" : "auto"}
        accessibilityElementsHidden={busy}
      >
        <DateField
          label={project ? "Start date" : "Date"}
          value={draft.date}
          onChange={(date) => update({ date })}
        />
        {!editing && !project && existingDates.includes(draft.date) && (
          <Text style={[styles.cardMeta, { color: colors.warning }]}>
            This date already has an entry. This will add a separate shift.
          </Text>
        )}
        {project ? (
          <>
            <Field
              label="Project name"
              value={draft.projectName}
              onChange={(projectName) => update({ projectName })}
            />
            <DateField
              label="End date"
              value={draft.endDate}
              onChange={(endDate) => update({ endDate })}
            />
            <Field
              label="Flat payout"
              numeric
              value={draft.flatAmount}
              onChange={(flatAmount) => update({ flatAmount })}
            />
            <Text style={styles.cardMeta}>Currency</Text>
            <Choices
              options={currencies.map((code) => ({ value: code, label: code }))}
              value={draft.currency}
              onChange={(currency) => update({ currency })}
            />
          </>
        ) : (
          <>
            <OptionalTime
              label="Clock In"
              value={draft.start}
              onChange={(start) =>
                update({ start, ...(!start ? { paid: false } : {}) })
              }
            />
            <OptionalTime
              label="Clock Out"
              value={draft.end}
              onChange={(end) =>
                update({ end, ...(!end ? { paid: false } : {}) })
              }
            />
            <Text style={styles.cardMeta}>Lunch input</Text>
            <Text style={styles.cardMeta}>
              Use one method. Switching clears the previous lunch input.
            </Text>
            <Choices
              value={lunchMode}
              options={[
                { value: "times", label: "Start / end times" },
                { value: "minutes", label: "Total minutes" },
              ]}
              onChange={(mode) => {
                if (mode !== lunchMode) {
                  setLunchMode(mode);
                  update({ lunchStart: "", lunchEnd: "", lunchMinutes: "0" });
                }
              }}
            />
            {lunchMode === "times" && (
              <>
                <OptionalTime
                  label="Lunch Start"
                  value={draft.lunchStart}
                  onChange={(lunchStart) => update({ lunchStart })}
                />
                <OptionalTime
                  label="Lunch End"
                  value={draft.lunchEnd}
                  onChange={(lunchEnd) => update({ lunchEnd })}
                />
              </>
            )}
            {lunchMode === "minutes" && (
              <Field
                label="Recorded lunch (minutes)"
                numeric
                value={draft.lunchMinutes}
                onChange={(lunchMinutes) => update({ lunchMinutes })}
              />
            )}
            <Toggle
              title="Paid lunch (counts toward paid hours)"
              value={draft.lunchPaid}
              onChange={(lunchPaid) => update({ lunchPaid })}
            />
            {!draft.breaks.length ? (
              <Field
                label="Unpaid breaks (minutes)"
                numeric
                value={draft.breakMinutes}
                onChange={(breakMinutes) => update({ breakMinutes })}
              />
            ) : (
              <>
                <Text style={styles.cardMeta}>
                  Recorded unpaid breaks: {duration(Number(draft.breakMinutes))}
                  . The total is kept with the recorded times.
                </Text>
                <Action
                  title="Replace recorded breaks with total minutes"
                  onPress={() => update({ breaks: [] })}
                />
              </>
            )}
            <Field
              label="Break label"
              value={draft.breakLabel}
              onChange={(breakLabel) => update({ breakLabel })}
            />
            {draft.breaks.map((item) => (
              <Text key={item.id} style={styles.cardMeta}>
                {item.label || "Break"}: {timeLabel(item.start)} →{" "}
                {item.end ? timeLabel(item.end) : "Incomplete"}
              </Text>
            ))}
            <Field
              label="Custom hourly rate (optional)"
              numeric
              value={draft.customRate}
              onChange={(customRate) => update({ customRate })}
            />
            <Field
              label="Tips earned"
              numeric
              value={draft.tips}
              onChange={(tips) => update({ tips })}
            />
            {Number(draft.tips) > 0 && (
              <Choices
                options={[
                  { value: "cash", label: "Cash" },
                  { value: "paycheck", label: "On Paycheck" },
                  { value: "card", label: "Card" },
                  { value: "other", label: "Other" },
                ]}
                value={draft.tipType}
                onChange={(tipType) =>
                  update({ tipType: tipType as EntryDraft["tipType"] })
                }
              />
            )}
          </>
        )}
        <Text style={styles.cardMeta}>Job (optional)</Text>
        <Choices
          value={draft.jobId ?? ""}
          onChange={(jobId) =>
            update({
              jobId: jobId || null,
              ...(!project
                ? {
                    currency:
                      jobs.find((job) => job.id === jobId)?.currency ??
                      defaultCurrency,
                  }
                : {}),
            })
          }
          options={[
            { value: "", label: "No job assigned" },
            ...jobs
              .filter((job) => !job.archived || job.id === draft.jobId)
              .map((job) => ({
                value: job.id,
                label: job.archived ? `${job.name} (removed)` : job.name,
              })),
          ]}
        />
        <Field
          label="Notes (optional)"
          multiline
          value={draft.notes}
          onChange={(notes) => update({ notes })}
        />
        {paymentLocked ? (
          <Text style={styles.cardMeta}>
            Paid via Paycheck. Manage payment status in Pay.
          </Text>
        ) : complete ? (
          <Toggle
            title="Payment received"
            value={draft.paid}
            onChange={(paid) => update({ paid })}
          />
        ) : (
          <Text style={styles.cardMeta}>
            Incomplete shift: no wages or worked hours until both clock times
            are saved. This does not start a running timer.
          </Text>
        )}
        {preview.ok && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.cardTitle}>Preview</Text>
            {!project && (
              <Text style={styles.cardMeta}>
                {duration(workedMinutes(preview.entry))} paid work
                {draft.end && draft.start && draft.end < draft.start
                  ? " · Clock Out is the next day"
                  : ""}
              </Text>
            )}
            <Text style={styles.cardMeta}>
              Gross including tips:{" "}
              {payVisible
                ? money(
                    preview.entry.earnings +
                      (project ? 0 : (preview.entry.tips ?? 0)),
                    preview.entry.currency ?? defaultCurrency,
                  )
                : "•••••"}
            </Text>
          </View>
        )}
        {!preview.ok && <Text style={styles.cardMeta}>{preview.error}</Text>}
      </View>
      {error && (
        <Text
          accessibilityRole="alert"
          style={[styles.cardMeta, { color: colors.danger }]}
        >
          {error}
        </Text>
      )}
      <Action
        title={
          busy
            ? "Saving…"
            : editing
              ? "Save Changes"
              : project
                ? "Save Project"
                : complete
                  ? "Save completed shift"
                  : "Save incomplete entry"
        }
        disabled={busy}
        onPress={() => {
          void onSave(draft)
            .then(setError)
            .catch(() =>
              setError(
                "Could not save. Your changes are still here. Please try again.",
              ),
            );
        }}
      />
    </View>
  );
}
