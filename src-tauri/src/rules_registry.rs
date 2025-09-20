use std::{collections::HashMap, sync::Arc};

use go_rules::{
    BoardSnapshot, Captures, Color, GameConfig, GameState, Move, MoveOutcome, Point, RuleViolation,
    ScoreSummary,
};
use parking_lot::Mutex;
use serde::Serialize;
use uuid::Uuid;

#[derive(Clone, Debug)]
pub struct RulesRegistry {
    games: Arc<Mutex<HashMap<Uuid, GameState>>>,
}

#[derive(Debug, thiserror::Error)]
pub enum RulesError {
    #[error("game {0} not found")]
    NotFound(Uuid),
    #[error(transparent)]
    Rule(#[from] RuleViolation),
}

#[derive(Clone, Debug, Serialize)]
pub struct GameStateSnapshot {
    pub game_id: Uuid,
    pub board: BoardSnapshot,
    pub captures: Captures,
    pub to_move: Color,
    pub legal_moves: Vec<Point>,
    pub consecutive_passes: u8,
    pub config: GameConfig,
    pub move_count: usize,
}

#[derive(Clone, Debug, Serialize)]
pub struct GameSummary {
    pub game_id: Uuid,
    pub config: GameConfig,
    pub to_move: Color,
    pub move_count: usize,
    pub consecutive_passes: u8,
}

impl RulesRegistry {
    pub fn new() -> Self {
        Self {
            games: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn create_game(&self, config: GameConfig) -> (Uuid, GameStateSnapshot) {
        let game = GameState::new(config.clone());
        let game_id = Uuid::new_v4();
        let mut games = self.games.lock();
        games.insert(game_id, game);
        drop(games);
        let snapshot = self.snapshot(game_id).expect("game just inserted");
        (game_id, snapshot)
    }

    pub fn list_games(&self) -> Vec<GameSummary> {
        let games = self.games.lock();
        games
            .iter()
            .map(|(id, game)| GameSummary {
                game_id: *id,
                config: game.config().clone(),
                to_move: game.to_move(),
                move_count: game.move_count(),
                consecutive_passes: game.consecutive_passes(),
            })
            .collect()
    }

    pub fn snapshot(&self, game_id: Uuid) -> Result<GameStateSnapshot, RulesError> {
        let games = self.games.lock();
        let game = games.get(&game_id).ok_or(RulesError::NotFound(game_id))?;
        Ok(GameStateSnapshot {
            game_id,
            board: game.board_snapshot(),
            captures: game.captures(),
            to_move: game.to_move(),
            legal_moves: game.legal_moves(),
            consecutive_passes: game.consecutive_passes(),
            config: game.config().clone(),
            move_count: game.move_count(),
        })
    }

    pub fn play_move(&self, game_id: Uuid, mv: Move) -> Result<MoveOutcome, RulesError> {
        let mut games = self.games.lock();
        let game = games
            .get_mut(&game_id)
            .ok_or(RulesError::NotFound(game_id))?;
        let outcome = game.play(mv)?;
        Ok(outcome)
    }

    pub fn score(&self, game_id: Uuid) -> Result<ScoreSummary, RulesError> {
        let games = self.games.lock();
        let game = games.get(&game_id).ok_or(RulesError::NotFound(game_id))?;
        Ok(game.score())
    }
}
