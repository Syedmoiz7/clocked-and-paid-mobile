import {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren,
} from "react";
import { colors, makeStyles, styles, themedColors } from "../theme";
import { useAppSelector } from "../store/hooks";
const Context = createContext({ colors, styles });
export function ThemeProvider({ children }: PropsWithChildren) {
  const hue = useAppSelector((state) => state.app.preferences.themeHue);
  const value = useMemo(() => {
    const colors = themedColors(hue);
    return { colors, styles: makeStyles(colors) };
  }, [hue]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useThemeTokens = () => useContext(Context);
