mod app_state;
mod commands;
mod db;
mod errors;

use app_state::AppState;
use commands::{bootstrap_app, vacuum_database};
use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| -> tauri::Result<()> {
            let handle = app.handle();
            let state = AppState::new(handle.clone())
                .map_err(|err| tauri::Error::from_anyhow(anyhow::anyhow!(err.to_string())))?;
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![bootstrap_app, vacuum_database])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
