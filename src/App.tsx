import { HashRouter as Router, NavLink, Route, Routes } from "react-router-dom";
import { useAppInitialization } from "./hooks/useAppInitialization";
import HomePage from "./pages/HomePage";
import PlayersPage from "./pages/PlayersPage";
import TournamentsPage from "./pages/TournamentsPage";
import PuzzlesPage from "./pages/PuzzlesPage";
import SettingsPage from "./pages/SettingsPage";

const navLinks = [
  { to: "/", label: "Dashboard" },
  { to: "/players", label: "Players" },
  { to: "/tournaments", label: "Tournaments" },
  { to: "/puzzles", label: "Puzzles" },
  { to: "/settings", label: "Settings" },
];

export default function App() {
  const { status, error, bootstrapInfo } = useAppInitialization();

  return (
    <Router>
      <div className="app-shell">
        <nav className="app-nav">
          <div>
            <h1>Offline Go</h1>
            <p style={{ opacity: 0.7, fontSize: "0.85rem", marginTop: "0.15rem" }}>
              Local-first Go server & study suite
            </p>
          </div>
          <ul>
            {navLinks.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  end={link.to === "/"}
                  className={({ isActive }) => (isActive ? "active" : undefined)}
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <main className="app-content">
          {status !== "ready" ? (
            <div className="empty-state">
              <div>
                <h2>{status === "error" ? "Initialization failed" : "Starting Offline Go"}</h2>
                <p>
                  {status === "error"
                    ? error ?? "Unknown error"
                    : "Preparing local database, engines, and sync providers."}
                </p>
              </div>
            </div>
          ) : (
            <Routes>
              <Route path="/" element={<HomePage bootstrapInfo={bootstrapInfo} />} />
              <Route path="/players" element={<PlayersPage />} />
              <Route path="/tournaments" element={<TournamentsPage />} />
              <Route path="/puzzles" element={<PuzzlesPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          )}
        </main>
      </div>
    </Router>
  );
}
