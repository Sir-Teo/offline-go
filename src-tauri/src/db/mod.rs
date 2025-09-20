use std::{fs, path::PathBuf, sync::Arc};

use parking_lot::Mutex;
use rusqlite::Connection;

use crate::errors::{AppError, AppResult};

#[derive(Clone)]
pub struct Database {
    path: PathBuf,
    connection: Arc<Mutex<Connection>>,
}

impl Database {
    pub fn connect(path: PathBuf) -> AppResult<Self> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }

        let connection = Connection::open(&path)?;
        let db = Self {
            path,
            connection: Arc::new(Mutex::new(connection)),
        };

        db.configure()?;
        db.apply_migrations()?;

        Ok(db)
    }

    fn configure(&self) -> AppResult<()> {
        let conn = self.connection.lock();
        conn.execute_batch(
            r#"
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA foreign_keys = ON;
            PRAGMA busy_timeout = 5000;
        "#,
        )?;
        Ok(())
    }

    pub fn apply_migrations(&self) -> AppResult<()> {
        let conn = self.connection.lock();
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS app_meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            INSERT OR IGNORE INTO app_meta(key, value) VALUES ('schema_version', '1');

            CREATE TABLE IF NOT EXISTS players (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                display_name TEXT,
                rank INTEGER,
                rating REAL NOT NULL DEFAULT 1500.0,
                rating_deviation REAL NOT NULL DEFAULT 350.0,
                rating_volatility REAL NOT NULL DEFAULT 0.06,
                federation_id TEXT,
                metadata TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS rating_history (
                id TEXT PRIMARY KEY,
                player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
                rating REAL NOT NULL,
                rating_deviation REAL NOT NULL,
                rating_volatility REAL NOT NULL,
                period TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS tournaments (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                start_date TEXT,
                end_date TEXT,
                rounds INTEGER NOT NULL DEFAULT 0,
                board_size INTEGER NOT NULL DEFAULT 19,
                komi REAL NOT NULL DEFAULT 6.5,
                byo_yomi TEXT,
                ruleset TEXT NOT NULL DEFAULT 'AGA',
                pairing_settings TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS rounds (
                id TEXT PRIMARY KEY,
                tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
                round_index INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                starts_at TEXT,
                ends_at TEXT,
                UNIQUE(tournament_id, round_index)
            );

            CREATE TABLE IF NOT EXISTS games (
                id TEXT PRIMARY KEY,
                source TEXT NOT NULL DEFAULT 'local',
                black_player_id TEXT REFERENCES players(id) ON DELETE SET NULL,
                white_player_id TEXT REFERENCES players(id) ON DELETE SET NULL,
                winner TEXT,
                result TEXT,
                board_size INTEGER NOT NULL DEFAULT 19,
                komi REAL NOT NULL DEFAULT 6.5,
                handicap INTEGER NOT NULL DEFAULT 0,
                played_at TEXT,
                tournament_id TEXT REFERENCES tournaments(id) ON DELETE SET NULL,
                round_index INTEGER,
                sgf_path TEXT,
                gtp_log_path TEXT,
                metadata TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS pairings (
                id TEXT PRIMARY KEY,
                tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
                round_index INTEGER NOT NULL,
                table_number INTEGER NOT NULL,
                black_player_id TEXT REFERENCES players(id) ON DELETE SET NULL,
                white_player_id TEXT REFERENCES players(id) ON DELETE SET NULL,
                result TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                game_id TEXT REFERENCES games(id) ON DELETE SET NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(tournament_id, round_index, table_number)
            );

            CREATE TABLE IF NOT EXISTS puzzles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                source TEXT,
                difficulty INTEGER,
                tags TEXT,
                sgf_path TEXT NOT NULL,
                digest TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS puzzle_attempts (
                id TEXT PRIMARY KEY,
                puzzle_id TEXT NOT NULL REFERENCES puzzles(id) ON DELETE CASCADE,
                player_id TEXT REFERENCES players(id) ON DELETE SET NULL,
                outcome TEXT NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 1,
                solved_at TEXT NOT NULL,
                metadata TEXT
            );

            CREATE TABLE IF NOT EXISTS joseki_patterns (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                line TEXT NOT NULL,
                tags TEXT,
                difficulty INTEGER,
                sgf_path TEXT NOT NULL,
                metadata TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sync_events (
                id TEXT PRIMARY KEY,
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                action TEXT NOT NULL,
                payload TEXT,
                version INTEGER NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sync_peers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                last_synced_at TEXT,
                metadata TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_rating_history_player_id ON rating_history(player_id);
            CREATE INDEX IF NOT EXISTS idx_games_tournament ON games(tournament_id, round_index);
            CREATE INDEX IF NOT EXISTS idx_pairings_tournament_round ON pairings(tournament_id, round_index);
            CREATE INDEX IF NOT EXISTS idx_puzzle_attempts_player ON puzzle_attempts(player_id);
            CREATE INDEX IF NOT EXISTS idx_sync_events_entity ON sync_events(entity_type, entity_id, version);
        "#,
        )?;

        Ok(())
    }

    pub fn vacuum(&self) -> AppResult<()> {
        let conn = self.connection.lock();
        conn.execute("VACUUM", [])?;
        Ok(())
    }

    pub fn path(&self) -> &PathBuf {
        &self.path
    }

    pub fn with_conn<T, F>(&self, f: F) -> AppResult<T>
    where
        F: FnOnce(&Connection) -> AppResult<T>,
    {
        let conn = self.connection.lock();
        f(&conn)
    }

    pub fn schema_version(&self) -> AppResult<i64> {
        let conn = self.connection.lock();
        let value: String = conn
            .prepare("SELECT value FROM app_meta WHERE key = 'schema_version' LIMIT 1")
            .and_then(|mut stmt| stmt.query_row([], |row| row.get(0)))?;
        value
            .parse::<i64>()
            .map_err(|_| AppError::other(format!("invalid schema version: {value}")))
    }
}
