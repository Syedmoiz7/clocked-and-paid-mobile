import {
  useDispatch,
  useSelector,
  useStore,
  type TypedUseSelectorHook,
} from "react-redux";
import type { AppDispatch, AppStore, RootState } from "./store";

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppStore = useStore.withTypes<AppStore>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
