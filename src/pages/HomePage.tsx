import type { BootstrapSummary } from "../state/appState";

interface Props {
  bootstrapInfo?: BootstrapSummary;
}

export default function HomePage({ bootstrapInfo }: Props) {
  return (
    <section>
      <header style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ margin: 0 }}>Welcome back</h2>
        <p style={{ margin: "0.35rem 0", opacity: 0.7 }}>
          Everything you need to run tournaments, review games, and drill patterns—fully offline.
        </p>
      </header>
      <div className="status-banner">
        <strong>Database ready.</strong> Schema v{bootstrapInfo?.schemaVersion ?? "?"} at {bootstrapInfo?.dataDir ?? "unknown"}.
      </div>
    </section>
  );
}
