import { useUpgrade } from "../../src/features/auth/useUpgrade";
import { useRef, useState } from "react";
import { JobsScreen } from "../../src/screens/JobsScreen";
import {
  useAppDispatch,
  useAppSelector,
  useAppStore,
} from "../../src/store/hooks";
import {
  removeDeduction,
  removeJob,
  setDefaultJob,
  selectJob,
  setPayVisible,
  upsertDeduction,
  upsertJob,
} from "../../src/store/appSlice";
import {
  jobEditError,
  jobDeductionError,
  jobInProgress,
  validateJob,
  workInProgress,
} from "../../src/features/jobs/model";
import { entitlementsFor } from "../../src/services/entitlements";
import { commitWorkspaceAction } from "../../src/services/commitWorkspace";
import { saveAppState } from "../../src/services/storage";

export default function JobsRoute() {
  const onPremium = useUpgrade(undefined, "/jobs");
  const data = useAppSelector((state) => state.app);
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const pending = useRef(false);
  const [saving, setSaving] = useState(false);
  const read = () => store.getState().app;
  const commit = async (
    action: Parameters<typeof commitWorkspaceAction>[0],
  ) => {
    if (pending.current) return "Please wait for the current save to finish.";
    pending.current = true;
    setSaving(true);
    try {
      return (await commitWorkspaceAction(action, {
        read,
        write: saveAppState,
        dispatch,
      }))
        ? null
        : "This action is no longer available. Check the current profile and try again.";
    } catch {
      return "Could not save on this device. Your saved data and draft have been kept. Please try again.";
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };
  const currentJobError = (id: string) =>
    read().jobs.some((job) => job.id === id && !job.archived)
      ? null
      : "This job has been removed. Close the editor and try again.";
  return (
    <JobsScreen
      data={data}
      saving={saving}
      onSave={async (job, existing) => {
        if (existing && currentJobError(job.id)) return currentJobError(job.id);
        if (!existing && read().jobs.some((item) => item.id === job.id))
          return "This job already exists. Close the form and try again.";
        const error = validateJob(job) ?? jobEditError(read(), job);
        return error ?? (await commit(upsertJob(job)));
      }}
      onDefault={async (id) =>
        currentJobError(id) ??
        (workInProgress(read())
          ? "Finish or resolve running/recoverable shifts before changing the default."
          : await commit(setDefaultJob(id)))
      }
      onSelect={async (id) =>
        currentJobError(id) ??
        (workInProgress(read())
          ? "Finish or resolve running/recoverable shifts before switching Tracker profiles."
          : await commit(selectJob(id)))
      }
      onDelete={async (id) =>
        currentJobError(id) ??
        (jobInProgress(read(), id)
          ? "Finish or recover this job’s shift before removing the profile."
          : await commit(removeJob(id)))
      }
      onDeduction={async (deduction, jobId) => {
        const state = read();
        return (
          jobDeductionError(state, deduction, jobId) ??
          (await commit(upsertDeduction(deduction)))
        );
      }}
      onDeleteDeduction={async (id, jobId) => {
        if (!entitlementsFor(read()).deductionsManager)
          return "Preview Premium to edit deductions.";
        if (
          !read().deductions.some(
            (item) => item.id === id && item.jobId === jobId,
          )
        )
          return "This deduction no longer exists for this job.";
        return currentJobError(jobId) ?? (await commit(removeDeduction(id)));
      }}
      onPayVisibility={() => dispatch(setPayVisible(!read().payVisible))}
      onPremium={onPremium}
    />
  );
}
