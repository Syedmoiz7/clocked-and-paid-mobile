import { useUpgrade } from "../../src/features/auth/useUpgrade";
import { TrackerRoute } from "../../src/navigation/TrackerRoute";

export default function TrackerTabRoute() {
  const onPremium = useUpgrade(undefined, "/tracker");
  return <TrackerRoute onPremium={onPremium} />;
}
