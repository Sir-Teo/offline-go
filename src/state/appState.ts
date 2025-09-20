import { create } from "zustand";

export interface BootstrapSummary {
  dataDir: string;
  databasePath: string;
  schemaVersion: number;
}

type BootstrapStatus = "idle" | "loading" | "ready" | "error";

interface AppStore {
  status: BootstrapStatus;
  bootstrapInfo?: BootstrapSummary;
  error?: string;
  setStatus: (status: BootstrapStatus) => void;
  setBootstrapInfo: (summary: BootstrapSummary) => void;
  setError: (message: string | undefined) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  status: "idle",
  bootstrapInfo: undefined,
  error: undefined,
  setStatus: (status) => set({ status }),
  setBootstrapInfo: (bootstrapInfo) =>
    set({ bootstrapInfo, status: "ready", error: undefined }),
  setError: (message) => set({ error: message, status: message ? "error" : "idle" }),
}));
