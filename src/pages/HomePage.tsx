import { useMemo } from "react";
import { GoBoard } from "../components/GoBoard";
import { useGoGameSession } from "../hooks/useGoGameSession";
import type { BootstrapSummary } from "../state/appState";

interface Props {
  bootstrapInfo?: BootstrapSummary;
}

export default function HomePage({ bootstrapInfo }: Props) {
  const game = useGoGameSession(19);

  const intersections = useMemo(() => {
    const size = game.snapshot?.board.size ?? 19;
    return game.snapshot?.board.intersections ?? Array(size * size).fill(null);
  }, [game.snapshot]);

  return (
    <section style={{ display: "grid", gap: "1.5rem" }}>
      <header>
        <h2 style={{ margin: 0 }}>Welcome back</h2>
        <p style={{ margin: "0.35rem 0", opacity: 0.7 }}>
          Everything you need to run tournaments, review games, and drill patterns—fully offline.
        </p>
      </header>
      <div className="status-banner">
        <strong>Database ready.</strong> Schema v{bootstrapInfo?.schemaVersion ?? "?"} at {bootstrapInfo?.dataDir ?? "unknown"}.
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 320px",
          gap: "1.75rem",
        }}
      >
        <div>
          <h3 style={{ margin: "0 0 0.75rem 0" }}>Local game sandbox</h3>
          <GoBoard
            size={game.snapshot?.board.size ?? 19}
            intersections={intersections}
            lastMove={game.lastMove?.mv.point ?? undefined}
            disabled={game.loading}
            onPlay={(point) => game.playStone(point)}
          />
          <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem" }}>
            <button type="button" onClick={() => game.pass()} disabled={game.loading}>
              Pass turn ({game.toMove})
            </button>
            <button type="button" onClick={async () => {
              const summary = await game.score();
              if (!summary) return;
              console.table(summary);
            }}
            >
              Score
            </button>
          </div>
        </div>
        <aside
          style={{
            background: "rgba(255,255,255,0.04)",
            borderRadius: "0.75rem",
            border: "1px solid rgba(255,255,255,0.06)",
            padding: "1rem",
            display: "grid",
            gap: "0.75rem",
            alignSelf: "start",
          }}
        >
          <h3 style={{ margin: 0 }}>Game state</h3>
          <dl style={{ margin: 0, display: "grid", gap: "0.4rem" }}>
            <InfoRow label="Game ID" value={game.gameId ?? "…"} />
            <InfoRow label="Move" value={game.snapshot?.moveCount ?? 0} />
            <InfoRow label="To move" value={game.toMove} />
            <InfoRow
              label="Captures"
              value={`B ${game.snapshot?.captures.black ?? 0} / W ${game.snapshot?.captures.white ?? 0}`}
            />
            <InfoRow label="Consecutive passes" value={game.snapshot?.consecutivePasses ?? 0} />
            <InfoRow label="Status" value={game.loading ? "Working…" : game.error ? `Error: ${game.error}` : "Ready"} />
          </dl>
        </aside>
      </div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
      <span style={{ opacity: 0.7 }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
