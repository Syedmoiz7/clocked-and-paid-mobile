import { useAppSelector } from "../../store/hooks";
import { clockLabel } from "./model";
export function useClockFormat() {
  const format = useAppSelector((state) => state.app.preferences.clockFormat);
  return {
    format,
    timeLabel: (value: string | null | undefined) =>
      value
        ? clockLabel(
            value.includes("T")
              ? new Date(value).toTimeString().slice(0, 5)
              : value,
            format,
          )
        : "—",
  };
}
