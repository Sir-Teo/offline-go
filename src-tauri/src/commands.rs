use serde::Serialize;
use tauri::State;

use crate::{
    app_state::AppState,
    errors::{AppError, AppResult},
};

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
