mod app_state;
mod commands;
mod db;
mod errors;
mod rules_registry;

use app_state::AppState;
use commands::{
    bootstrap_app, create_game, get_game_state, list_games, play_game_move, score_game,
    vacuum_database,
};
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
        .invoke_handler(tauri::generate_handler![
            bootstrap_app,
            vacuum_database,
            create_game,
            list_games,
            get_game_state,
            play_game_move,
            score_game,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
