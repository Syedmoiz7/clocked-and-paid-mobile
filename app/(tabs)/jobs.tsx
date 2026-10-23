import { Alert } from "react-native";
import { JobsScreen } from "../../src/screens/JobsScreen";
import { useAppDispatch, useAppSelector } from "../../src/store/hooks";
import {
  removeDeduction,
  removeJob,
  setDefaultJob,
  setPremiumPreview,
  upsertDeduction,
  upsertJob,
} from "../../src/store/appSlice";

export default function JobsRoute() {
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
      onPremium={() =>
        Alert.alert(
          "Preview Premium",
          "Enable local mock Premium entitlements. No purchase or charge is made.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Start preview",
              onPress: () => dispatch(setPremiumPreview(true)),
            },
          ],
        )
      }
    />
  );
}
