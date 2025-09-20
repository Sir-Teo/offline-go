use serde::Serialize;

use crate::{color::Color, point::Point};

#[derive(Debug, thiserror::Error, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum RuleViolation {
    #[error("intersection {point:?} is already occupied")]
    Occupied { point: Point },
    #[error("move at {point:?} is suicidal")]
    Suicide { point: Point },
    #[error("move repeats a previous board state (superko)")]
    SuperKo,
    #[error("move out of bounds at {point:?}")]
    OutOfBounds { point: Point },
    #[error("move from wrong player; expected {expected:?}")]
    WrongPlayer { expected: Color },
}

impl RuleViolation {
    pub fn as_str(&self) -> &str {
        match self {
            RuleViolation::Occupied { .. } => "occupied",
            RuleViolation::Suicide { .. } => "suicide",
            RuleViolation::SuperKo => "superko",
            RuleViolation::OutOfBounds { .. } => "out_of_bounds",
            RuleViolation::WrongPlayer { .. } => "wrong_player",
        }
    }
}
