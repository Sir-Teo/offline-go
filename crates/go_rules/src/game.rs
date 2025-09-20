use std::collections::HashSet;

use serde::{Deserialize, Serialize};

use crate::{board::Board, color::Color, error::RuleViolation, point::Point};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(default)]
pub struct GameConfig {
    pub size: usize,
    pub komi: f64,
    pub superko: bool,
}

impl Default for GameConfig {
    fn default() -> Self {
        Self {
            size: 19,
            komi: 6.5,
            superko: true,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Move {
    pub color: Color,
    pub point: Option<Point>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct Captures {
    pub black: u32,
    pub white: u32,
}

#[derive(Clone, Debug, Serialize)]
pub struct MoveRecordSnapshot {
    pub mv: Move,
    pub captured: Vec<Point>,
    pub move_number: usize,
}

#[derive(Clone, Debug, Serialize)]
pub struct BoardSnapshot {
    pub size: usize,
    pub intersections: Vec<Option<Color>>,
}

#[derive(Clone, Debug, Serialize)]
pub struct MoveOutcome {
    pub board: BoardSnapshot,
    pub captures: Captures,
    pub to_move: Color,
    pub game_over: bool,
    pub consecutive_passes: u8,
    pub last_move: MoveRecordSnapshot,
    pub legal_moves: Vec<Point>,
}

#[derive(Clone, Debug, Serialize)]
pub struct ScoreSummary {
    pub black_score: f64,
    pub white_score: f64,
    pub territory_black: u32,
    pub territory_white: u32,
    pub captures: Captures,
    pub komi: f64,
}

#[derive(Clone)]
pub struct GameState {
    board: Board,
    to_move: Color,
    history: HashSet<u64>,
    captures: Captures,
    config: GameConfig,
    consecutive_passes: u8,
    moves: Vec<MoveRecord>,
}

#[derive(Clone)]
struct MoveRecord {
    mv: Move,
    captured: Vec<Point>,
}

impl GameState {
    pub fn new(config: GameConfig) -> Self {
        let board = Board::new(config.size);
        let mut history = HashSet::new();
        history.insert(board.position_key(Color::Black));
        Self {
            board,
            to_move: Color::Black,
            history,
            captures: Captures::default(),
            config,
            consecutive_passes: 0,
            moves: Vec::new(),
        }
    }

    pub fn board_snapshot(&self) -> BoardSnapshot {
        BoardSnapshot {
            size: self.board.size(),
            intersections: self.board.intersections().to_vec(),
        }
    }

    pub fn captures(&self) -> Captures {
        self.captures.clone()
    }

    pub fn to_move(&self) -> Color {
        self.to_move
    }

    pub fn consecutive_passes(&self) -> u8 {
        self.consecutive_passes
    }

    pub fn config(&self) -> &GameConfig {
        &self.config
    }

    pub fn legal_moves(&self) -> Vec<Point> {
        let mut legal = Vec::new();
        let size = self.board.size();
        for index in 0..size * size {
            if self.board.intersections()[index].is_some() {
                continue;
            }
            let point = Point::from_index(index, size);
            let mv = Move {
                color: self.to_move,
                point: Some(point),
            };
            if self.simulate(&mv).is_ok() {
                legal.push(point);
            }
        }
        legal
    }

    fn simulate(&self, mv: &Move) -> Result<(Board, Vec<Point>, u64), RuleViolation> {
        if mv.color != self.to_move {
            return Err(RuleViolation::WrongPlayer {
                expected: self.to_move,
            });
        }
        match mv.point {
            None => {
                let key = self.board.position_key(self.to_move.opponent());
                Ok((self.board.clone(), Vec::new(), key))
            }
            Some(point) => {
                if point.x as usize >= self.board.size() || point.y as usize >= self.board.size() {
                    return Err(RuleViolation::OutOfBounds { point });
                }
                let (next_board, captured) = self.board.after_play(mv.color, point)?;
                let key = next_board.position_key(self.to_move.opponent());
                if self.config.superko && self.history.contains(&key) {
                    return Err(RuleViolation::SuperKo);
                }
                Ok((next_board, captured, key))
            }
        }
    }

    pub fn play(&mut self, mv: Move) -> Result<MoveOutcome, RuleViolation> {
        let (next_board, captured, key) = self.simulate(&mv)?;

        if mv.point.is_none() {
            self.consecutive_passes = self.consecutive_passes.saturating_add(1);
        } else {
            self.consecutive_passes = 0;
        }

        // update captures
        if mv.point.is_some() {
            match mv.color {
                Color::Black => self.captures.black += captured.len() as u32,
                Color::White => self.captures.white += captured.len() as u32,
            }
        }

        self.board = next_board;
        self.to_move = self.to_move.opponent();
        self.history.insert(key);

        let record = MoveRecord {
            mv: mv.clone(),
            captured: captured.clone(),
        };
        self.moves.push(record);

        let outcome = MoveOutcome {
            board: self.board_snapshot(),
            captures: self.captures.clone(),
            to_move: self.to_move,
            game_over: self.consecutive_passes >= 2,
            consecutive_passes: self.consecutive_passes,
            last_move: MoveRecordSnapshot {
                mv,
                captured,
                move_number: self.moves.len(),
            },
            legal_moves: self.legal_moves(),
        };

        Ok(outcome)
    }

    pub fn move_count(&self) -> usize {
        self.moves.len()
    }

    pub fn score(&self) -> ScoreSummary {
        let territory = self.board.territory_map();
        let mut territory_black = 0u32;
        let mut territory_white = 0u32;
        for owner in territory {
            match owner {
                Some(Color::Black) => territory_black += 1,
                Some(Color::White) => territory_white += 1,
                None => {}
            }
        }

        let black_score = territory_black as f64 + self.captures.black as f64;
        let white_score = territory_white as f64 + self.captures.white as f64 + self.config.komi;

        ScoreSummary {
            black_score,
            white_score,
            territory_black,
            territory_white,
            captures: self.captures.clone(),
            komi: self.config.komi,
        }
    }

    #[cfg(test)]
    pub(crate) fn set_internal_state(
        &mut self,
        board: Board,
        history: HashSet<u64>,
        to_move: Color,
    ) {
        self.board = board;
        self.history = history;
        self.to_move = to_move;
    }

    pub fn move_history(&self) -> Vec<MoveRecordSnapshot> {
        self.moves
            .iter()
            .enumerate()
            .map(|(idx, record)| MoveRecordSnapshot {
                mv: record.mv.clone(),
                captured: record.captured.clone(),
                move_number: idx + 1,
            })
            .collect()
    }
}
