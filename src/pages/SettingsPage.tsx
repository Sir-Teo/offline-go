import { useEffect, useState } from "react";
import { listEngines, removeEngine, type GtpEngineInfo } from "../lib/gtp";

export default function SettingsPage() {
  return (
    <section>
      <header style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ margin: 0 }}>Settings</h2>
        <p style={{ margin: "0.35rem 0", opacity: 0.7 }}>
          Configure engines, synchronization, and data export preferences.
        </p>
      </header>
      <GtpEnginesPanel />
      <p style={{ opacity: 0.65 }}>
        Engine selection, backups, and sync settings will live here.
      </p>
    </section>
  );
}

function GtpEnginesPanel() {
  const [engines, setEngines] = useState<GtpEngineInfo[]>([]);
  const [error, setError] = useState<string>();

  useEffect(() => {
    async function load() {
      try {
        const list = await listEngines();
        setEngines(list);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
    load();
  }, []);

  if (error) {
    return (
      <div
        style={{
          padding: "1rem",
          borderRadius: "0.75rem",
          border: "1px solid rgba(255,0,0,0.35)",
          background: "rgba(255,0,0,0.1)",
          marginBottom: "1rem",
        }}
      >
        Failed to read engines: {error}
      </div>
    );
  }

  return (
    <article
      style={{
        background: "rgba(255,255,255,0.04)",
        borderRadius: "0.75rem",
        border: "1px solid rgba(255,255,255,0.06)",
        padding: "1rem",
        marginBottom: "1rem",
      }}
    >
      <h3 style={{ marginTop: 0 }}>Registered GTP engines</h3>
      {engines.length === 0 ? (
        <p style={{ opacity: 0.7 }}>No engines yet. Add KataGo, Leela Zero, or your favourite bot.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.5rem" }}>
          {engines.map((engine) => (
            <li
              key={engine.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.6rem 0.8rem",
                borderRadius: "0.6rem",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <div>
                <strong>{engine.name}</strong>
                <p style={{ margin: "0.2rem 0", opacity: 0.7 }}>{engine.path}</p>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={async () => {
                    await removeEngine(engine.id);
                    setEngines((prev) => prev.filter((item) => item.id !== engine.id));
                  }}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
