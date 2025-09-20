import { useMemo } from "react";
import { ratePlayer, type Rating } from "../lib/glicko";

function RatingPreview() {
  const player: Rating = {
    rating: 1830,
    deviation: 62,
    volatility: 0.05,
  };

  const opponents = useMemo(
    () => [
      {
        label: "Up-table win",
        rating: { rating: 1920, deviation: 45, volatility: 0.04 },
        score: 1 as const,
      },
      {
        label: "Down-table draw",
        rating: { rating: 1705, deviation: 80, volatility: 0.06 },
        score: 0.5 as const,
      },
      {
        label: "Down-table loss",
        rating: { rating: 1650, deviation: 55, volatility: 0.05 },
        score: 0 as const,
      },
    ],
    [],
  );

  const update = useMemo(() => {
    return ratePlayer(
      player,
      opponents.map((item) => ({ opponent: item.rating, score: item.score })),
    );
  }, [opponents, player]);

  return (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "0.75rem",
        }}
      >
        <Metric label="New rating" value={update.rating.toFixed(1)} delta={update.ratingDelta} />
        <Metric label="Deviation" value={update.deviation.toFixed(1)} delta={update.deviationDelta} />
        <Metric label="Volatility" value={update.volatility.toFixed(4)} delta={update.volatilityDelta} />
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.4rem" }}>
        {opponents.map((item) => (
          <li
            key={item.label}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "rgba(255,255,255,0.02)",
              borderRadius: "0.65rem",
              padding: "0.65rem 0.8rem",
            }}
          >
            <span>{item.label}</span>
            <span style={{ opacity: 0.7 }}>
              vs {item.rating.rating.toFixed(0)} ({item.score === 1 ? "Win" : item.score === 0.5 ? "Draw" : "Loss"})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Metric({ label, value, delta }: { label: string; value: string; delta: number }) {
  const sign = delta >= 0 ? "+" : "";
  return (
    <div
      style={{
        padding: "0.75rem",
        borderRadius: "0.6rem",
        background: "rgba(30, 157, 247, 0.12)",
        border: "1px solid rgba(30,157,247,0.25)",
      }}
    >
      <p style={{ margin: 0, fontSize: "0.75rem", opacity: 0.75 }}>{label}</p>
      <p style={{ margin: "0.2rem 0 0 0", fontSize: "1.35rem" }}>{value}</p>
      <p style={{ margin: 0, fontSize: "0.75rem", opacity: 0.7 }}>{sign}{delta.toFixed(2)}</p>
    </div>
  );
}

export default function PlayersPage() {
  return (
    <section>
      <header style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ margin: 0 }}>Players</h2>
        <p style={{ margin: "0.35rem 0", opacity: 0.7 }}>
          Manage local roster, ratings, and sync with federations when available.
        </p>
      </header>
      <section style={{ display: "grid", gap: "1rem" }}>
        <article
          style={{
            background: "rgba(255,255,255,0.04)",
            borderRadius: "0.75rem",
            padding: "1rem",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Glicko-2 preview</h3>
          <p style={{ opacity: 0.7, marginTop: 0 }}>
            Estimated changes after the latest rating period. Configure opponents or import from a tournament file.
          </p>
          <RatingPreview />
        </article>
        <p style={{ opacity: 0.65 }}>
          Player management UI coming together soon. Import from CSV or pair against your local engines.
        </p>
      </section>
    </section>
  );
}
