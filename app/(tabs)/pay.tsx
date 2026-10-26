import { useUpgrade } from "../../src/features/auth/useUpgrade";
import { useRef, useState } from "react";
import { Alert } from "react-native";
import { PayScreen } from "../../src/screens/PayScreen";
import {
  useAppDispatch,
  useAppSelector,
  useAppStore,
} from "../../src/store/hooks";
import {
  deletePaycheck,
  markHistoryPaidMany,
  recordPaycheck,
  removeDeduction,
  savePaySchedule,
  setPayVisible,
  setPremiumPreview,
  upsertDeduction,
  upsertDeductionsMany,
} from "../../src/store/appSlice";
import {
  consumptionIds,
  receiptError,
  validateDeduction,
  validateSchedule,
} from "../../src/features/pay/model";
import { entitlementsFor } from "../../src/services/entitlements";
import { commitWorkspaceAction } from "../../src/services/commitWorkspace";
import { saveAppState } from "../../src/services/storage";

export default function PayRoute() {
  const onPremium = useUpgrade("advancedPay", "/pay");
  const data = useAppSelector((state) => state.app);
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const save = async (
    action: Parameters<typeof commitWorkspaceAction>[0],
    premium = true,
  ) => {
    if (pending.current) return "Please wait for the current save to finish.";
    if (premium && !entitlementsFor(store.getState().app).advancedPay)
      return "Preview Premium to use this Pay action.";
    pending.current = true;
    setBusy(true);
    try {
      const changed = await commitWorkspaceAction(action, {
        read: () => store.getState().app,
        write: saveAppState,
        dispatch,
      });
      return changed
        ? null
        : "This action is no longer available. Check the current data and try again.";
    } catch {
      return "Could not save on this device. Your saved data has been kept. Please try again.";
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const run = (operation: Promise<string | null>) => {
    void operation.then((error) => {
      if (error) Alert.alert("Pay unchanged", error);
    });
  };
  return (
    <PayScreen
      data={data}
      busy={busy}
      onPremium={onPremium}
      onEndPreview={() => dispatch(setPremiumPreview(false))}
      onPayVisible={(value) => dispatch(setPayVisible(value))}
      onSchedule={async (scope, schedule, applyToJob) => {
        const error = validateSchedule(schedule);
        return (
          error ??
          (await save(savePaySchedule({ scope, schedule, applyToJob }), false))
        );
      }}
      onDeduction={async (deduction) =>
        validateDeduction(deduction) ?? (await save(upsertDeduction(deduction)))
      }
      onDeductionMany={async (deductions) =>
        deductions.map(validateDeduction).find(Boolean) ??
        (await save(upsertDeductionsMany(deductions)))
      }
      onDeleteDeduction={(id) => run(save(removeDeduction(id)))}
      onMarkPaid={(ids) => run(save(markHistoryPaidMany(ids)))}
      onUndoReceipt={(id) => run(save(deletePaycheck(id)))}
      onReceipt={async (paycheck, markShifts) => {
        const data = store.getState().app;
        const validation = receiptError(data, paycheck);
        if (validation) return validation;
        return save(
          recordPaycheck({
            paycheck,
            markShifts,
            consumeDeductionIds: consumptionIds(data, paycheck),
          }),
        );
      }}
    />
  );
}
