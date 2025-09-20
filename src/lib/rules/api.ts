import { invoke } from "@tauri-apps/api/core";
import type {
  GameConfig,
  GameStateSnapshot,
  GameSummary,
  MoveOutcome,
  PointPayload,
  ScoreSummary,
  StoneColor,
} from "./types";

export type { GameConfig, GameStateSnapshot, GameSummary, MoveOutcome, PointPayload, ScoreSummary, StoneColor };

export interface CreateGameOptions {
  size?: number;
  komi?: number;
  superko?: boolean;
}

export async function createGame(options: CreateGameOptions = {}): Promise<GameStateSnapshot> {
  const snapshot = await invoke<GameStateSnapshot>("create_game", { config: options });
  return normalizeSnapshot(snapshot);
}

export async function listGames(): Promise<GameSummary[]> {
  return invoke<GameSummary[]>("list_games");
}

export async function getGameState(gameId: string): Promise<GameStateSnapshot> {
  const snapshot = await invoke<GameStateSnapshot>("get_game_state", { gameId });
  return normalizeSnapshot(snapshot);
}

export async function playMove(
  gameId: string,
  color: StoneColor,
  point: PointPayload | null,
): Promise<MoveOutcome> {
  const outcome = await invoke<MoveOutcome>("play_game_move", {
    payload: {
      gameId,
      color,
      point,
    },
  });
  return normalizeOutcome(outcome);
}

export async function scoreGame(gameId: string): Promise<ScoreSummary> {
  return invoke<ScoreSummary>("score_game", { gameId });
}

function normalizeSnapshot(snapshot: GameStateSnapshot): GameStateSnapshot {
  return {
    ...snapshot,
    board: normalizeBoard(snapshot.board),
    legalMoves: snapshot.legalMoves.map(normalizePoint),
  };
}

function normalizeOutcome(outcome: MoveOutcome): MoveOutcome {
  return {
    ...outcome,
    board: normalizeBoard(outcome.board),
    legalMoves: outcome.legalMoves.map(normalizePoint),
    lastMove: {
      ...outcome.lastMove,
      mv: {
        color: outcome.lastMove.mv.color,
        point: outcome.lastMove.mv.point ? normalizePoint(outcome.lastMove.mv.point) : null,
      },
      captured: outcome.lastMove.captured.map(normalizePoint),
    },
  };
}

function normalizeBoard(board: GameStateSnapshot["board"]): GameStateSnapshot["board"] {
  return {
    ...board,
    intersections: board.intersections.map((value) => (value === null ? null : value)),
  };
}

function normalizePoint(point: PointPayload): PointPayload {
  return { x: point.x, y: point.y };
}
