use std::path::PathBuf;

use tauri::{AppHandle, Manager};

use crate::{db::Database, errors::AppResult, rules_registry::RulesRegistry};

#[derive(Clone)]
pub struct AppState {
    data_dir: PathBuf,
    database: Database,
    rules: RulesRegistry,
}

impl AppState {
    pub fn new(handle: AppHandle) -> AppResult<Self> {
        let mut data_dir = handle.path().app_data_dir()?;
        data_dir.push("offline-go");
        std::fs::create_dir_all(&data_dir)?;

        let db_path = data_dir.join("offline_go.db3");
        let database = Database::connect(db_path)?;
        let rules = RulesRegistry::new();

        Ok(Self {
            data_dir,
            database,
            rules,
        })
    }

    pub fn database(&self) -> &Database {
        &self.database
    }

    pub fn data_dir(&self) -> &PathBuf {
        &self.data_dir
    }

    pub fn rules(&self) -> &RulesRegistry {
        &self.rules
    }
}
