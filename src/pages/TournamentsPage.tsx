import { useMemo } from "react";
import { generateSwissPairings, type SwissPlayer } from "../lib/pairings";

const sampleRoster: SwissPlayer[] = [
  {
    id: "alice",
    name: "Alice",
    score: 3,
    rating: 2100,
    opponents: ["dan", "erin", "fran"],
    colorHistory: ["black", "white", "black"],
  },
  {
    id: "bob",
    name: "Bob",
    score: 2.5,
    rating: 2040,
    opponents: ["fran", "alice", "ivy"],
    colorHistory: ["white", "black", "white"],
  },
  {
    id: "carol",
    name: "Carol",
    score: 2.5,
    rating: 1990,
    opponents: ["ivy", "hank", "dan"],
    colorHistory: ["black", "black", "white"],
  },
  {
    id: "dan",
    name: "Dan",
    score: 2,
    rating: 1920,
    opponents: ["alice", "george", "carol"],
    colorHistory: ["white", "white", "black"],
  },
  {
    id: "erin",
    name: "Erin",
    score: 2,
    rating: 1875,
    opponents: ["george", "alice", "fran"],
    colorHistory: ["black", "black", "white"],
  },
  {
    id: "fran",
    name: "Fran",
    score: 1.5,
    rating: 1850,
    opponents: ["bob", "george", "erin"],
    colorHistory: ["black", "white", "black"],
  },
  {
    id: "george",
    name: "George",
    score: 1.5,
    rating: 1790,
    opponents: ["erin", "dan", "fran"],
    colorHistory: ["white", "black", "white"],
  },
  {
    id: "hank",
    name: "Hank",
    score: 1,
    rating: 1760,
    opponents: ["ivy", "carol", "bob"],
    colorHistory: ["white", "white", "black"],
  },
  {
    id: "ivy",
    name: "Ivy",
    score: 1,
    rating: 1680,
    opponents: ["carol", "bob", "hank"],
    colorHistory: ["white", "white", "white"],
  },
];

export default function TournamentsPage() {
  const pairings = useMemo(() => generateSwissPairings(sampleRoster), []);

  return (
    <section>
      <header style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ margin: 0 }}>Tournaments</h2>
        <p style={{ margin: "0.35rem 0", opacity: 0.7 }}>
          Configure Swiss rounds, pairings, timing rules, and upload results at your leisure.
        </p>
      </header>
      <article
        style={{
          background: "rgba(255,255,255,0.04)",
          borderRadius: "0.75rem",
          padding: "1rem",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Round 4 Swiss Pairings (preview)</h3>
        <p style={{ opacity: 0.7 }}>
          Generated locally using the pairing engine. Colors balance consecutive streaks and minimise rematches.
        </p>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", opacity: 0.75 }}>
              <th style={{ padding: "0.4rem" }}>Table</th>
              <th style={{ padding: "0.4rem" }}>Black</th>
              <th style={{ padding: "0.4rem" }}>White</th>
              <th style={{ padding: "0.4rem" }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {pairings.pairings.map((pair) => (
              <tr key={pair.table} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <td style={{ padding: "0.5rem" }}>{pair.table}</td>
                <td style={{ padding: "0.5rem" }}>{renderPlayer(pair.black)}</td>
                <td style={{ padding: "0.5rem" }}>{renderPlayer(pair.white)}</td>
                <td style={{ padding: "0.5rem", opacity: 0.7 }}>
                  {pair.float ? `${pair.float === "down" ? "Float down" : "Float up"}` : ""}
                </td>
              </tr>
            ))}
            {pairings.bye && (
              <tr style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <td style={{ padding: "0.5rem" }}>—</td>
                <td style={{ padding: "0.5rem" }} colSpan={2}>
                  {renderPlayer(pairings.bye)}
                </td>
                <td style={{ padding: "0.5rem", opacity: 0.7 }}>BYE (1 point)</td>
              </tr>
            )}
          </tbody>
        </table>
      </article>
      <p style={{ opacity: 0.65, marginTop: "1.5rem" }}>
        Tournament builder UI placeholder. We will stitch in the pairing and rating engines next.
      </p>
    </section>
  );
}

function renderPlayer(id: string) {
  const player = sampleRoster.find((p) => p.id === id);
  if (!player) return id;
  return `${player.name ?? player.id} (${player.score} pts)`;
}
