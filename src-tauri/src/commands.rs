use go_rules::{Color, GameConfig, Move, MoveOutcome, Point, ScoreSummary};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;
use uuid::Uuid;

use crate::{
    app_state::AppState,
    errors::{AppError, AppResult},
    rules_registry::{GameStateSnapshot, GameSummary, RulesError},
};
#[derive(Default, Deserialize)]
pub struct CreateGameRequest {
    pub size: Option<usize>,
    pub komi: Option<f64>,
    pub superko: Option<bool>,
}

impl CreateGameRequest {
    fn into_config(self) -> GameConfig {
        let mut config = GameConfig::default();
        if let Some(size) = self.size {
            config.size = size;
        }
        if let Some(komi) = self.komi {
            config.komi = komi;
        }
        if let Some(superko) = self.superko {
            config.superko = superko;
        }
        config
    }
}

#[derive(Deserialize)]
pub struct PointPayload {
    pub x: usize,
    pub y: usize,
}

impl PointPayload {
    fn into_point(self) -> AppResult<Point> {
        Point::new(self.x, self.y).map_err(AppError::other)
    }
}

#[derive(Deserialize)]
pub struct MovePayload {
    pub game_id: Uuid,
    pub color: Color,
    pub point: Option<PointPayload>,
}

impl MovePayload {
    fn into_parts(self) -> AppResult<(Uuid, Move)> {
        let point = match self.point {
            Some(payload) => Some(payload.into_point()?),
            None => None,
        };
        Ok((
            self.game_id,
            Move {
                color: self.color,
                point,
            },
        ))
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncOperationInput {
    pub id: String,
    pub entity_type: String,
    pub entity_id: String,
    pub action: String,
    pub payload: Value,
    pub created_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncOperationRecord {
    pub id: String,
    pub entity_type: String,
    pub entity_id: String,
    pub op: String,
    pub payload: Value,
    pub version: i64,
    pub created_at: String,
}

fn map_rules_error(err: RulesError) -> AppError {
    match err {
        RulesError::NotFound(id) => AppError::other(format!("game {id} not found")),
        RulesError::Rule(rule) => AppError::other(rule.to_string()),
    }
}

#[derive(Serialize)]
pub struct BootstrapSummary {
    pub data_dir: String,
    pub database_path: String,
    pub schema_version: i64,
}

/// Initialize the application: ensures the SQLite database is migrated and ready for use.
#[tauri::command]
pub async fn bootstrap_app(state: State<'_, AppState>) -> AppResult<BootstrapSummary> {
    let db = state.database().clone();
    let data_dir = state.data_dir().clone();

    tauri::async_runtime::spawn_blocking(move || db.apply_migrations())
        .await
        .map_err(|err| crate::errors::AppError::other(format!("task join error: {err}")))??;

    let schema_version = state.database().schema_version()?;
    let database_path = state.database().path().display().to_string();

    Ok(BootstrapSummary {
        data_dir: data_dir.display().to_string(),
        database_path,
        schema_version,
    })
}

/// Vacuum the SQLite file to reclaim disk space.
#[tauri::command]
pub async fn vacuum_database(state: State<'_, AppState>) -> AppResult<()> {
    let db = state.database().clone();
    tauri::async_runtime::spawn_blocking(move || db.vacuum())
        .await
        .map_err(|err| crate::errors::AppError::other(format!("task join error: {err}")))??;
    Ok(())
}

/// Create a new in-memory Go game managed by the rules registry.
#[tauri::command]
pub async fn create_game(
    state: State<'_, AppState>,
    config: Option<CreateGameRequest>,
) -> AppResult<GameStateSnapshot> {
    let config = config.unwrap_or_default().into_config();
    let (_, snapshot) = state.rules().create_game(config);
    Ok(snapshot)
}

/// List the active in-memory Go games.
#[tauri::command]
pub async fn list_games(state: State<'_, AppState>) -> AppResult<Vec<GameSummary>> {
    Ok(state.rules().list_games())
}

/// Fetch the latest snapshot for a specific game.
#[tauri::command]
pub async fn get_game_state(
    state: State<'_, AppState>,
    game_id: Uuid,
) -> AppResult<GameStateSnapshot> {
    state.rules().snapshot(game_id).map_err(map_rules_error)
}

/// Play a move inside an active game.
#[tauri::command]
pub async fn play_game_move(
    state: State<'_, AppState>,
    payload: MovePayload,
) -> AppResult<MoveOutcome> {
    let (game_id, mv) = payload.into_parts()?;
    state
        .rules()
        .play_move(game_id, mv)
        .map_err(map_rules_error)
}

/// Calculate area score + captures for an active game.
#[tauri::command]
pub async fn score_game(state: State<'_, AppState>, game_id: Uuid) -> AppResult<ScoreSummary> {
    state.rules().score(game_id).map_err(map_rules_error)
}

/// Persist optimistic updates queued on the client.
#[tauri::command]
pub async fn push_sync_operations(
    state: State<'_, AppState>,
    operations: Vec<SyncOperationInput>,
) -> AppResult<Vec<SyncOperationRecord>> {
    if operations.is_empty() {
        return Ok(Vec::new());
    }

    let db = state.database().clone();
    tauri::async_runtime::spawn_blocking(move || {
        db.with_conn(|conn| {
            let tx = conn.unchecked_transaction()?;
            let mut next_version: i64 = tx
                .prepare("SELECT COALESCE(MAX(version), 0) FROM sync_events")?
                .query_row([], |row| row.get(0))?;
            let mut stmt = tx.prepare(
                "INSERT INTO sync_events (id, entity_type, entity_id, action, payload, version, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            )?;
            let mut inserted = Vec::with_capacity(operations.len());
            for op in operations {
                next_version += 1;
                stmt.execute(params![
                    op.id,
                    op.entity_type,
                    op.entity_id,
                    op.action,
                    op.payload,
                    next_version,
                    op.created_at,
                ])?;
                inserted.push(SyncOperationRecord {
                    id: op.id,
                    entity_type: op.entity_type,
                    entity_id: op.entity_id,
                    op: op.action,
                    payload: op.payload,
                    version: next_version,
                    created_at: op.created_at,
                });
            }
            drop(stmt);
            tx.commit()?;
            Ok(inserted)
        })
    })
    .await
    .map_err(|err| AppError::other(format!("task join error: {err}")))?
}

/// Fetch sync events newer than the supplied version.
#[tauri::command]
pub async fn fetch_sync_operations(
    state: State<'_, AppState>,
    since: Option<i64>,
    limit: Option<u32>,
) -> AppResult<Vec<SyncOperationRecord>> {
    let db = state.database().clone();
    let since_version = since.unwrap_or(0);
    let capped_limit = limit.unwrap_or(64).clamp(1, 512) as i64;

    tauri::async_runtime::spawn_blocking(move || {
        db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, entity_type, entity_id, action, payload, version, created_at
                 FROM sync_events
                 WHERE version > ?1
                 ORDER BY version ASC
                 LIMIT ?2",
            )?;
            let mut rows = stmt.query(params![since_version, capped_limit])?;
            let mut out = Vec::new();
            while let Some(row) = rows.next()? {
                out.push(SyncOperationRecord {
                    id: row.get(0)?,
                    entity_type: row.get(1)?,
                    entity_id: row.get(2)?,
                    op: row.get(3)?,
                    payload: row.get(4)?,
                    version: row.get(5)?,
                    created_at: row.get(6)?,
                });
            }
            Ok(out)
        })
    })
    .await
    .map_err(|err| AppError::other(format!("task join error: {err}")))?
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GtpEngineInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub args: Vec<String>,
    pub working_directory: Option<String>,
    pub enabled: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertGtpEngine {
    pub id: Option<String>,
    pub name: String,
    pub path: String,
    pub args: Option<Vec<String>>,
    pub working_directory: Option<String>,
    pub enabled: Option<bool>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GtpSessionInfo {
    pub session_id: String,
    pub engine_id: String,
    pub status: String,
    pub started_at: String,
}

#[tauri::command]
pub async fn list_gtp_engines(state: State<'_, AppState>) -> AppResult<Vec<GtpEngineInfo>> {
    let db = state.database().clone();
    tauri::async_runtime::spawn_blocking(move || {
        db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, name, path, args, working_directory, enabled, created_at, updated_at FROM gtp_engines ORDER BY name",
            )?;
            let mut rows = stmt.query([])?;
            let mut engines = Vec::new();
            while let Some(row) = rows.next()? {
                let args: String = row.get(3)?;
                engines.push(GtpEngineInfo {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    path: row.get(2)?,
                    args: serde_json::from_str(&args).unwrap_or_default(),
                    working_directory: row.get(4)?,
                    enabled: row.get::<_, i64>(5)? != 0,
                    created_at: row.get(6)?,
                    updated_at: row.get(7)?,
                });
            }
            Ok(engines)
        })
    })
    .await
    .map_err(|err| AppError::other(format!("task join error: {err}")))?
}

#[tauri::command]
pub async fn register_gtp_engine(
    state: State<'_, AppState>,
    payload: UpsertGtpEngine,
) -> AppResult<GtpEngineInfo> {
    let db = state.database().clone();
    tauri::async_runtime::spawn_blocking(move || {
        db.with_conn(|conn| {
            let UpsertGtpEngine {
                id,
                name,
                path,
                args,
                working_directory,
                enabled,
            } = payload;

            let engine_id = id.unwrap_or_else(|| Uuid::new_v4().to_string());
            let args_json = serde_json::to_string(&args.unwrap_or_default())?;
            let enabled_flag = enabled.unwrap_or(true) as i64;

            conn.execute(
                "INSERT INTO gtp_engines (id, name, path, args, working_directory, enabled, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, COALESCE((SELECT created_at FROM gtp_engines WHERE id = ?1), CURRENT_TIMESTAMP), CURRENT_TIMESTAMP)
                 ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    path = excluded.path,
                    args = excluded.args,
                    working_directory = excluded.working_directory,
                    enabled = excluded.enabled,
                    updated_at = CURRENT_TIMESTAMP",
                params![engine_id, name, path, args_json, working_directory, enabled_flag],
            )?;

            let mut stmt = conn.prepare(
                "SELECT id, name, path, args, working_directory, enabled, created_at, updated_at FROM gtp_engines WHERE id = ?1",
            )?;
            let engine = stmt.query_row(params![engine_id.clone()], |row| {
                let args: String = row.get(3)?;
                Ok(GtpEngineInfo {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    path: row.get(2)?,
                    args: serde_json::from_str(&args).unwrap_or_default(),
                    working_directory: row.get(4)?,
                    enabled: row.get::<_, i64>(5)? != 0,
                    created_at: row.get(6)?,
                    updated_at: row.get(7)?,
                })
            })?;

            Ok(engine)
        })
    })
    .await
    .map_err(|err| AppError::other(format!("task join error: {err}")))?
}

#[tauri::command]
pub async fn remove_gtp_engine(state: State<'_, AppState>, engine_id: String) -> AppResult<()> {
    let db = state.database().clone();
    tauri::async_runtime::spawn_blocking(move || {
        db.with_conn(|conn| {
            conn.execute("DELETE FROM gtp_engines WHERE id = ?1", params![engine_id])?;
            Ok(())
        })
    })
    .await
    .map_err(|err| AppError::other(format!("task join error: {err}")))?
}

#[tauri::command]
pub async fn launch_gtp_engine(
    state: State<'_, AppState>,
    engine_id: String,
) -> AppResult<GtpSessionInfo> {
    let db = state.database().clone();
    tauri::async_runtime::spawn_blocking(move || {
        db.with_conn(|conn| {
            let session_id = Uuid::new_v4().to_string();
            let now = chrono::Utc::now().to_rfc3339();
            conn.execute(
                "INSERT INTO gtp_sessions (id, engine_id, status, started_at) VALUES (?1, ?2, ?3, ?4)",
                params![session_id, engine_id, "pending", now],
            )?;
            Ok(GtpSessionInfo {
                session_id,
                engine_id,
                status: "pending".to_string(),
                started_at: now,
            })
        })
    })
    .await
    .map_err(|err| AppError::other(format!("task join error: {err}")))?
}

#[tauri::command]
pub async fn stop_gtp_engine(state: State<'_, AppState>, session_id: String) -> AppResult<()> {
    let db = state.database().clone();
    tauri::async_runtime::spawn_blocking(move || {
        db.with_conn(|conn| {
            conn.execute(
                "UPDATE gtp_sessions SET status = ?2, stopped_at = CURRENT_TIMESTAMP WHERE id = ?1",
                params![session_id, "stopped"],
            )?;
            Ok(())
        })
    })
    .await
    .map_err(|err| AppError::other(format!("task join error: {err}")))?
}
