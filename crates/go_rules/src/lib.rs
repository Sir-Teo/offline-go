mod board;
mod color;
mod error;
mod game;
mod point;
mod zobrist;

pub use board::Board;
pub use color::Color;
pub use error::RuleViolation;
pub use game::{
    BoardSnapshot, Captures, GameConfig, GameState, Move, MoveOutcome, MoveRecordSnapshot,
    ScoreSummary,
};
pub use point::Point;

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use super::*;

    #[test]
    fn superko_is_prevented_when_repeating_position() {
        let config = GameConfig {
            size: 5,
            ..Default::default()
        };
        let mut game = GameState::new(config.clone());

        let mut board = Board::new(config.size);
        let idx = |x: usize, y: usize| Point::new(x, y).unwrap().to_index(config.size);

        // Surround a white stone at (1,1) leaving a single liberty at (1,0).
        board.set(idx(0, 1), Some(Color::Black));
        board.set(idx(2, 1), Some(Color::Black));
        board.set(idx(1, 2), Some(Color::Black));
        board.set(idx(1, 1), Some(Color::White));

        let ko_target = Point::new(1, 0).unwrap();
        let (board_after, _) = board.after_play(Color::Black, ko_target).unwrap();

        let mut history = HashSet::new();
        history.insert(board.position_key(Color::Black));
        history.insert(board_after.position_key(Color::White));

        game.set_internal_state(board, history, Color::Black);

        let err = game
            .play(Move {
                color: Color::Black,
                point: Some(ko_target),
            })
            .unwrap_err();

        assert!(matches!(err, RuleViolation::SuperKo));
    }

    #[test]
    fn suicide_move_is_rejected() {
        let config = GameConfig {
            size: 5,
            ..Default::default()
        };
        let mut game = GameState::new(config.clone());

        let mut board = Board::new(config.size);
        let idx = |x: usize, y: usize| Point::new(x, y).unwrap().to_index(config.size);

        board.set(idx(1, 0), Some(Color::White));
        board.set(idx(0, 1), Some(Color::White));
        board.set(idx(2, 1), Some(Color::White));
        board.set(idx(1, 2), Some(Color::White));

        let mut history = HashSet::new();
        history.insert(board.position_key(Color::Black));

        game.set_internal_state(board, history, Color::Black);

        let err = game
            .play(Move {
                color: Color::Black,
                point: Some(Point::new(1, 1).unwrap()),
            })
            .unwrap_err();

        assert!(matches!(err, RuleViolation::Suicide { .. }));
    }

    #[test]
    fn scoring_accounts_for_komi() {
        let config = GameConfig {
            size: 9,
            komi: 7.5,
            ..Default::default()
        };
        let game = GameState::new(config.clone());

        let score = game.score();
        assert_eq!(score.black_score, 0.0);
        assert!((score.white_score - config.komi).abs() < f64::EPSILON);
    }
}
