import { useEffect, useRef, useState } from "react";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";

// Android dialogs are imperative. Rendering their component on every tracker
// tick reopens the dialog and overwrites the user's unfinished selection.
export function useAndroidPicker(
  mode: "date" | "time",
  onChange: (date: Date) => void,
) {
  const [isOpen, setIsOpen] = useState(false);
  const active = useRef(false);
  const latestChange = useRef(onChange);
  latestChange.current = onChange;

  useEffect(
    () => () => {
      if (active.current) {
        active.current = false;
        void DateTimePickerAndroid.dismiss(mode);
      }
    },
    [mode],
  );

  const show = (value: Date, is24Hour?: boolean) => {
    if (active.current) return;
    active.current = true;
    setIsOpen(true);
    DateTimePickerAndroid.open({
      mode,
      value,
      is24Hour,
      onChange: (event, date) => {
        if (!active.current) return;
        active.current = false;
        setIsOpen(false);
        if (event.type === "set" && date) latestChange.current(date);
      },
      onError: () => {
        active.current = false;
        setIsOpen(false);
      },
    });
  };

  return { isOpen, show };
}
