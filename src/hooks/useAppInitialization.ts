import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore, type BootstrapSummary } from "../state/appState";

export function useAppInitialization() {
  const status = useAppStore((state) => state.status);
  const setStatus = useAppStore((state) => state.setStatus);
  const setBootstrapInfo = useAppStore((state) => state.setBootstrapInfo);
  const setError = useAppStore((state) => state.setError);

  useEffect(() => {
    let disposed = false;

    async function run() {
      if (status === "ready" || status === "loading") {
        return;
      }

      setStatus("loading");

      try {
        const summary = (await invoke("bootstrap_app")) as BootstrapSummary;
        if (!disposed) {
          setBootstrapInfo(summary);
        }
      } catch (err) {
        console.error("bootstrap failed", err);
        if (!disposed) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    }

    run();

    return () => {
      disposed = true;
    };
  }, [setBootstrapInfo, setError, setStatus, status]);

  const error = useAppStore((state) => state.error);
  const bootstrapInfo = useAppStore((state) => state.bootstrapInfo);

  return { status, error, bootstrapInfo };
}
