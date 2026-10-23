import { useUpgrade } from "../../src/features/auth/useUpgrade";
import { JobsScreen } from "../../src/screens/JobsScreen";
import { useAppDispatch, useAppSelector } from "../../src/store/hooks";
import {
  removeDeduction,
  removeJob,
  setDefaultJob,
  upsertDeduction,
  upsertJob,
} from "../../src/store/appSlice";

export default function JobsRoute() {
  const onPremium = useUpgrade(undefined, "/jobs");
  const data = useAppSelector((state) => state.app);
  const dispatch = useAppDispatch();
  return (
    <JobsScreen
      data={data}
      onSave={(job) => dispatch(upsertJob(job))}
      onDefault={(id) => dispatch(setDefaultJob(id))}
      onDelete={(id) => dispatch(removeJob(id))}
      onDeduction={(deduction) => dispatch(upsertDeduction(deduction))}
      onDeleteDeduction={(id) => dispatch(removeDeduction(id))}
      onPremium={onPremium}
    />
  );
}
