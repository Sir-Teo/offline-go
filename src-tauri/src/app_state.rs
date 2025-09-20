use std::path::PathBuf;

use tauri::AppHandle;

use crate::{
    db::Database,
    errors::{AppError, AppResult},
};

#[derive(Clone)]
pub struct AppState {
    handle: AppHandle,
    data_dir: PathBuf,
    database: Database,
}

impl AppState {
    pub fn new(handle: AppHandle) -> AppResult<Self> {
        let mut data_dir = handle
            .path()
            .app_data_dir()
            .ok_or_else(|| AppError::other("App data directory unavailable"))?;
        data_dir.push("offline-go");
        std::fs::create_dir_all(&data_dir)?;

        let db_path = data_dir.join("offline_go.db3");
        let database = Database::connect(db_path)?;

        Ok(Self {
            handle,
            data_dir,
            database,
        })
    }

    pub fn database(&self) -> &Database {
        &self.database
    }

    pub fn data_dir(&self) -> &PathBuf {
        &self.data_dir
    }

    pub fn handle(&self) -> &AppHandle {
        &self.handle
    }
}
