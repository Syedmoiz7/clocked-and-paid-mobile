import { Redirect } from "expo-router";
import { useAppSelector } from "../src/store/hooks";
import { entryDestination } from "../src/features/auth/model";

export default function IndexRoute() {
  const data = useAppSelector((state) => state.app);
  return <Redirect href={entryDestination(data)} />;
}
