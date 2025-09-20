mod app_state;
mod commands;
mod db;
mod errors;
mod rules_registry;

use app_state::AppState;
use commands::{
    bootstrap_app, create_game, fetch_sync_operations, get_game_state, launch_gtp_engine,
    list_games, list_gtp_engines, play_game_move, push_sync_operations, register_gtp_engine,
    remove_gtp_engine, score_game, stop_gtp_engine, vacuum_database,
};
use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(
            |app: &mut tauri::App| -> Result<(), Box<dyn std::error::Error>> {
                let handle = app.handle();
                let state = AppState::new(handle.clone())
                    .map_err(|err| -> Box<dyn std::error::Error> { Box::new(err) })?;
                app.manage(state);
                Ok(())
            },
        )
        .invoke_handler(tauri::generate_handler![
            bootstrap_app,
            vacuum_database,
            create_game,
            list_games,
            get_game_state,
            play_game_move,
            score_game,
            push_sync_operations,
            fetch_sync_operations,
            list_gtp_engines,
            register_gtp_engine,
            remove_gtp_engine,
            launch_gtp_engine,
            stop_gtp_engine,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
