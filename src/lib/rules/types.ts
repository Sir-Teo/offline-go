export type StoneColor = "black" | "white";

export interface PointPayload {
  x: number;
  y: number;
}

export interface BoardSnapshot {
  size: number;
  intersections: Array<StoneColor | null>;
}

export interface CapturesSnapshot {
  black: number;
  white: number;
}

export interface MoveRecordSnapshot {
  mv: {
    color: StoneColor;
    point: PointPayload | null;
  };
  captured: PointPayload[];
  moveNumber: number;
}

export interface MoveOutcome {
  board: BoardSnapshot;
  captures: CapturesSnapshot;
  toMove: StoneColor;
  gameOver: boolean;
  consecutivePasses: number;
  lastMove: MoveRecordSnapshot;
  legalMoves: PointPayload[];
}

export interface GameStateSnapshot {
  gameId: string;
  board: BoardSnapshot;
  captures: CapturesSnapshot;
  toMove: StoneColor;
  legalMoves: PointPayload[];
  consecutivePasses: number;
  config: GameConfig;
  moveCount: number;
}

export interface GameConfig {
  size: number;
  komi: number;
  superko: boolean;
}

export interface GameSummary {
  gameId: string;
  config: GameConfig;
  toMove: StoneColor;
  moveCount: number;
  consecutivePasses: number;
}

export interface ScoreSummary {
  blackScore: number;
  whiteScore: number;
  territoryBlack: number;
  territoryWhite: number;
  captures: CapturesSnapshot;
  komi: number;
}
