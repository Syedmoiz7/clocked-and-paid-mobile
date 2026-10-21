export type TabKey = "tracker" | "history" | "pay" | "settings";

export type Shift = {
  id: string;
  date: string;
  startedAt: string;
  endedAt: string | null;
  lunchMinutes: number;
  breakMinutes: number;
  earnings: number;
};

export type AppState = {
  activeShift: Shift | null;
  history: Shift[];
  hourlyRate: number;
  isPremium: boolean;
};
