import { useEffect, useRef, useState } from "react";
import { Alert, Text, View } from "react-native";
import { Action, Choices, Field, Toggle } from "../../components/FormControls";
import { useThemeTokens } from "../../providers/ThemeProvider";
import type { AppState } from "../../types";
import type { ImportData } from "./backup";
import type { SettingsDraft } from "./model";
import { entitlementsFor } from "../../services/entitlements";
import { FormModal } from "../../components/FormModal";
import { workInProgress } from "../jobs/model";
import { importImpact } from "./importImpact";

export type RecoveryInfo = {
  imported: ImportData;
  savedAt: string;
  missing: number;
};
export type DataActions = {
  onExport: (format: "json" | "csv") => Promise<void>;
  onPick: () => Promise<ImportData | null>;
  onImport: (
    data: ImportData,
    mode: "merge" | "replace",
    settings: boolean,
  ) => Promise<SettingsDraft>;
  onRecover: (scan: RecoveryInfo) => Promise<void>;
  onScan: () => Promise<RecoveryInfo | null>;
  onReset: () => Promise<SettingsDraft>;
};
export function DataCards({
  data,
  actions,
  onPremium,
  blocked,
  unsavedPreferences,
}: {
  data: AppState;
  actions: DataActions;
  onPremium: () => void;
  blocked: boolean;
  unsavedPreferences: boolean;
}) {
  const { colors, styles } = useThemeTokens();
  const entitlements = entitlementsFor(data);
  const [pending, setPending] = useState<ImportData | null>(null),
    [mode, setMode] = useState<"merge" | "replace">("merge"),
    [includeSettings, setIncludeSettings] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const operationPending = useRef(false);
  const [scan, setScan] = useState<RecoveryInfo | null>(null),
    [scanned, setScanned] = useState(false),
    [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState(""),
    [error, setError] = useState("");
  const [section, setSection] = useState("backup");
  const unavailable = busy || blocked;
  useEffect(() => {
    if (unsavedPreferences) setIncludeSettings(false);
  }, [unsavedPreferences]);
  useEffect(() => {
    if (workInProgress(data)) setMode("merge");
  }, [data.activeShift, data.extraShifts, data.orphanedShift]);
  const run = async (
    operation: () => Promise<void>,
    success = "",
    section = "backup",
  ) => {
    if (operationPending.current || blocked) return;
    operationPending.current = true;
    setSection(section);
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      await operation();
      setFeedback(success);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Data operation failed.");
    } finally {
      operationPending.current = false;
      setBusy(false);
    }
  };
  const status = (value: string) =>
    section !== value ? null : (
      <>
        {busy && <Text style={styles.cardMeta}>Working…</Text>}
        {feedback !== "" && (
          <Text
            accessibilityRole="alert"
            style={{ color: colors.success, marginTop: 12 }}
          >
            {feedback}
          </Text>
        )}
        {error !== "" && (
          <Text
            accessibilityRole="alert"
            style={{ color: colors.danger, marginTop: 12 }}
          >
            {error}
          </Text>
        )}
      </>
    );
  return (
    <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Backup & Restore</Text>
        <Text style={styles.cardMeta}>
          JSON is a lossless business-data backup. CSV contains history only.
          Exported files are unencrypted; store them safely. Privacy
          credentials, account passwords and Premium access are excluded.
        </Text>
        {entitlements.backupRestore ? (
          <>
            <Action
              title="Export JSON backup"
              disabled={unavailable}
              onPress={() => {
                void run(
                  () => actions.onExport("json"),
                  "Backup share sheet closed. Confirm you saved the file to your chosen destination.",
                );
              }}
            />
            <Action
              title="Export history CSV"
              disabled={unavailable}
              onPress={() => {
                void run(
                  () => actions.onExport("csv"),
                  "CSV share sheet closed. Confirm you saved the file.",
                );
              }}
            />
            <Action
              title="Choose backup file…"
              disabled={unavailable}
              onPress={() => {
                void run(async () => {
                  const result = await actions.onPick();
                  if (result) {
                    setPending(result);
                    setMode("merge");
                    setIncludeSettings(false);
                  }
                });
              }}
            />
            {pending && (
              <FormModal
                title="Review import"
                busy={unavailable}
                onClose={() => setPending(null)}
              >
                <View>
                  <Text style={[styles.cardTitle, { marginTop: 18 }]}>
                    Review import
                  </Text>
                  <Text style={styles.cardMeta}>
                    {pending.history.length} entries ·{" "}
                    {pending.jobs?.length ?? 0} jobs ·{" "}
                    {pending.deductions?.length ?? 0} deductions ·{" "}
                    {pending.paychecks?.length ?? 0} receipts
                  </Text>
                  {pending.warnings.map((warning) => (
                    <Text
                      key={warning}
                      style={{ color: colors.warning, marginTop: 8 }}
                    >
                      {warning}
                    </Text>
                  ))}
                  <Choices
                    disabled={unavailable}
                    value={mode}
                    options={[
                      { value: "merge", label: "Merge (keep existing IDs)" },
                      ...(!workInProgress(data)
                        ? [
                            {
                              value: "replace",
                              label: "Replace included collections",
                            },
                          ]
                        : []),
                    ]}
                    onChange={(value) => setMode(value as typeof mode)}
                  />
                  {workInProgress(data) && (
                    <Text style={styles.cardMeta}>
                      Finish or recover current work before replacing
                      collections. Merge keeps current sessions.
                    </Text>
                  )}
                  {importImpact(data, pending, mode).map((row) => (
                    <Text key={row.label} style={styles.cardMeta}>
                      {row.label}:{" "}
                      {row.included
                        ? `${row.incoming} in file · ${row.added} new IDs · ${row.conflicts} matching IDs ${mode === "merge" ? "kept" : "replaced"}${mode === "replace" ? ` · ${row.removed} current records removed` : ""}`
                        : "not included; current records kept"}
                    </Text>
                  ))}
                  <Text style={styles.cardMeta}>
                    Merge preserves existing records on ID conflicts. Replace
                    overwrites only the collections actually included in the
                    file. Unfinished imported shifts remain drafts.
                  </Text>
                  {pending.settings && (
                    <Toggle
                      title="Also restore preferences & defaults"
                      value={includeSettings}
                      disabled={unavailable || unsavedPreferences}
                      onChange={setIncludeSettings}
                    />
                  )}
                  {pending.settings && unsavedPreferences && (
                    <Text style={styles.cardMeta}>
                      Save or discard App preferences before including backup
                      preferences. Data-only import is available now.
                    </Text>
                  )}
                  {status("backup")}
                  <Action
                    title="Confirm import"
                    disabled={unavailable}
                    onPress={() =>
                      Alert.alert(
                        "Import backup?",
                        mode === "replace"
                          ? "The listed current records will be replaced. Device recovery retains missing prior history, but cannot undo changes to matching IDs."
                          : "Existing matching IDs are kept. New IDs are added. Review counts and warnings before continuing.",
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Import",
                            onPress: () => {
                              void run(async () => {
                                await actions.onImport(
                                  pending,
                                  mode,
                                  includeSettings,
                                );
                                setPending(null);
                              }, "Import completed locally. No cloud upload was made.");
                            },
                          },
                        ],
                      )
                    }
                  />
                  <Action
                    title="Cancel import"
                    disabled={unavailable}
                    onPress={() => setPending(null)}
                  />
                </View>
              </FormModal>
            )}
          </>
        ) : (
          <Action
            title="Preview Premium for backup & restore"
            onPress={onPremium}
          />
        )}
        <Text style={styles.cardMeta}>
          Guest and mock-account modes use this same local workspace. There is
          no cloud account migration or sync yet.
        </Text>
        {!pending && status("backup")}
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Data Recovery</Text>
        <Text style={styles.cardMeta}>
          Loaded history: {data.history.length} entries. A device recovery
          snapshot preserves a high-water history copy when entries are deleted.
          This is not a cloud backup.
        </Text>
        {entitlements.recoveryTools ? (
          <>
            <Action
              title="Scan device recovery snapshot"
              disabled={unavailable}
              onPress={() => {
                void run(
                  async () => {
                    setScan(await actions.onScan());
                    setScanned(true);
                  },
                  "",
                  "recovery",
                );
              }}
            />
            {scanned && (
              <Text style={styles.cardMeta}>
                {scan
                  ? `${scan.imported.history.length} backup entries · ${scan.missing} missing IDs · saved ${new Date(scan.savedAt).toLocaleString()}`
                  : "No device recovery snapshot available."}
              </Text>
            )}
            {scan && scan.missing > 0 && (
              <Action
                title={`Restore ${scan.missing} missing entries`}
                disabled={unavailable}
                onPress={() =>
                  Alert.alert(
                    "Recover missing history?",
                    "Only missing history and necessary removed-profile references are added. Current receipts, deductions, preferences and sessions are kept.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Recover",
                        onPress: () => {
                          void run(
                            async () => {
                              await actions.onRecover(scan);
                              setScan(null);
                              setScanned(false);
                            },
                            "Missing device history restored locally.",
                            "recovery",
                          );
                        },
                      },
                    ],
                  )
                }
              />
            )}
          </>
        ) : (
          <Action title="Preview Premium for recovery" onPress={onPremium} />
        )}
        {status("recovery")}
      </View>
      <View style={[styles.card, { borderColor: colors.danger }]}>
        <Text style={[styles.cardTitle, { color: colors.danger }]}>
          Danger Zone
        </Text>
        <Text style={styles.cardMeta}>
          Reset deletes all local history, running/orphaned sessions, jobs,
          deductions, receipts, preferences and recovery data. Export first.
          Your current mock/guest account mode, demo entitlement and secure
          privacy lock remain.
        </Text>
        <Action
          title="Reset local workspace…"
          disabled={unavailable}
          onPress={() => {
            setConfirm("");
            setResetOpen(true);
          }}
        />
        {status("reset")}
        {resetOpen && (
          <FormModal
            title="Reset local workspace"
            busy={unavailable}
            onClose={() => setResetOpen(false)}
          >
            <Text style={styles.cardMeta}>
              This clears business records and App preferences on this device.
              Account mode, demo entitlement and the secure privacy lock stay in
              place.
            </Text>
            <Field
              label="Type RESET to confirm"
              value={confirm}
              onChange={setConfirm}
            />
            <Action
              title="Reset local workspace"
              disabled={unavailable || confirm !== "RESET"}
              onPress={() =>
                Alert.alert(
                  "Delete local workspace?",
                  "This cannot be undone unless you saved an external backup. The device recovery snapshot is also removed. The privacy lock remains enabled.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete data",
                      style: "destructive",
                      onPress: () => {
                        void run(
                          async () => {
                            await actions.onReset();
                            setConfirm("");
                            setPending(null);
                            setScan(null);
                            setScanned(false);
                            setResetOpen(false);
                          },
                          "Local workspace reset. Old business records and recovery data were removed.",
                          "reset",
                        );
                      },
                    },
                  ],
                )
              }
            />
            {status("reset")}
          </FormModal>
        )}
      </View>
    </>
  );
}
