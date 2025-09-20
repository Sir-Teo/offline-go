import { create } from "zustand";
import { syncEngine, SyncOperationInput } from "../lib/storage/sync";

interface SyncState {
  isFlushing: boolean;
  lastPullAt?: string;
  lastFlushAt?: string;
  queueOperation: (op: SyncOperationInput) => Promise<void>;
  flush: () => Promise<void>;
  pull: () => Promise<void>;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  isFlushing: false,
  queueOperation: async (op) => {
    await syncEngine.queue(op);
  },
  flush: async () => {
    if (get().isFlushing) return;
    set({ isFlushing: true });
    try {
      await syncEngine.flushPending();
      set({ lastFlushAt: new Date().toISOString() });
    } finally {
      set({ isFlushing: false });
    }
  },
  pull: async () => {
    await syncEngine.pullRemote();
    set({ lastPullAt: new Date().toISOString() });
  },
}));
