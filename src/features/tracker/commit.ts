import { appReducer } from "../../store/appSlice";
import type { AppState } from "../../types";

// Persist the proposed transition before clearing a recoverable running session.
// The final reducer action applies to current Redux state, preserving unrelated edits.
export async function commitTrackerAction(
  action: Parameters<typeof appReducer>[1],
  ports: {
    read: () => AppState;
    write: (state: AppState) => Promise<void>;
    dispatch: (action: Parameters<typeof appReducer>[1]) => unknown;
  },
) {
  const before = ports.read();
  const proposed = appReducer(before, action);
  if (proposed === before) return false;
  await ports.write(proposed);
  ports.dispatch(action);
  return true;
}
