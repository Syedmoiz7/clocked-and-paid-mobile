import { useUpgrade } from "../../src/features/auth/useUpgrade";
import { PayScreen } from "../../src/screens/PayScreen";
import { useAppDispatch, useAppSelector } from "../../src/store/hooks";
import {
  deletePaycheck,
  markHistoryPaidMany,
  recordPaycheck,
  removeDeduction,
  savePaySchedule,
  setPayVisible,
  setPremiumPreview,
  upsertDeduction,
} from "../../src/store/appSlice";
import { consumptionIds, validateReceipt } from "../../src/features/pay/model";

export default function PayRoute() {
  const onPremium = useUpgrade("advancedPay", "/pay");
  const data = useAppSelector((state) => state.app);
  const dispatch = useAppDispatch();
  return (
    <PayScreen
      data={data}
      onPremium={onPremium}
      onEndPreview={() => dispatch(setPremiumPreview(false))}
      onPayVisible={(value) => dispatch(setPayVisible(value))}
      onSchedule={(scope, schedule, applyToJob) =>
        dispatch(savePaySchedule({ scope, schedule, applyToJob }))
      }
      onDeduction={(deduction) => dispatch(upsertDeduction(deduction))}
      onDeleteDeduction={(id) => dispatch(removeDeduction(id))}
      onMarkPaid={(ids) => dispatch(markHistoryPaidMany(ids))}
      onUndoReceipt={(id) => dispatch(deletePaycheck(id))}
      onReceipt={(paycheck, markShifts) => {
        const validation = validateReceipt(paycheck);
        if (validation) return validation;
        if (
          data.paychecks.some(
            (item) =>
              item.jobId === paycheck.jobId &&
              item.startDate <= paycheck.endDate &&
              item.endDate >= paycheck.startDate,
          )
        )
          return "A received paycheck already covers part of this period. Undo or adjust that receipt first.";
        dispatch(
          recordPaycheck({
            paycheck,
            markShifts,
            consumeDeductionIds: consumptionIds(data, paycheck),
          }),
        );
        return null;
      }}
    />
  );
}
