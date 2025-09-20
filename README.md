# Offline Go

Local-first desktop clone of the Online Go Server (OGS), packaged with Tauri, React, and a Rust core.

## Getting started

```bash
# install dependencies
npm install

# run the app in development mode
npm run tauri dev

# build a release package
npm run tauri build
```

> ℹ️ This repo avoids checking in `node_modules`. Make sure a recent Node.js (18+) toolchain is installed.

## Project layout

- `src/` – React + TypeScript application (board UI, pairings dashboard, puzzle trainer)
- `src-tauri/` – Rust backend (rules engine, Swiss pairing support, local SQLite storage, GTP orchestration)
- `crates/` – additional Rust crates (Go rules, SGF tooling) – added in subsequent commits
- `scripts/` – data importers (SGF/joseki/puzzles) – added in subsequent commits

## Local-first storage

The backend uses a bundled SQLite database under the OS app-data directory (`offline_go.db3`). Migrations run on startup via the `bootstrap_app` command exposed to the front-end and synchronized with IndexedDB caches (implemented later in the TypeScript layer).

## Roadmap

- [ ] Implement Go rule engine crate with full ko + positional superko detection
- [ ] Wire Swiss pairing service and Glicko-2 rating updates from the UI
- [ ] Add React board renderer and live analysis display
- [ ] Integrate GTP engine spawning + log capture
- [ ] Ship SGF / Tsumego / Joseki import pipelines
