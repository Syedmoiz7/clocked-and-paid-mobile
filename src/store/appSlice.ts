import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AppState, Shift } from "../types";

export const initialAppState: AppState = {
  activeShift: null,
  history: [],
  hourlyRate: 24,
  isPremium: false,
};

const appSlice = createSlice({
  name: "app",
  initialState: initialAppState,
  reducers: {
    hydrate: (_state, action: PayloadAction<AppState>) => action.payload,
    clockIn: (state, action: PayloadAction<Shift>) => {
      state.activeShift = action.payload;
    },
    clockOut: (state, action: PayloadAction<Shift>) => {
      state.activeShift = null;
      state.history.unshift(action.payload);
    },
  },
});

export const { hydrate, clockIn, clockOut } = appSlice.actions;
export const appReducer = appSlice.reducer;
