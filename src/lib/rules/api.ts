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

export type {
  GameConfig,
  GameStateSnapshot,
  GameSummary,
  MoveOutcome,
  PointPayload,
  ScoreSummary,
  StoneColor,
};

export interface CreateGameOptions {
  size?: number;
  komi?: number;
  superko?: boolean;
}

export async function createGame(options: CreateGameOptions = {}): Promise<GameStateSnapshot> {
  const snapshot = await invoke("create_game", { config: options });
  return normalizeSnapshot(snapshot);
}

export async function listGames(): Promise<GameSummary[]> {
  return invoke<GameSummary[]>("list_games");
}

export async function getGameState(gameId: string): Promise<GameStateSnapshot> {
  const snapshot = await invoke("get_game_state", { gameId });
  return normalizeSnapshot(snapshot);
}

export async function playMove(
  gameId: string,
  color: StoneColor,
  point: PointPayload | null,
): Promise<MoveOutcome> {
  const outcome = await invoke("play_game_move", {
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

function normalizeSnapshot(raw: any): GameStateSnapshot {
  const board = normalizeBoard(raw.board ?? raw.board_snapshot);
  const legalMoves = normalizePoints(raw.legalMoves ?? raw.legal_moves);
  return {
    gameId: raw.gameId ?? raw.game_id ?? "",
    board,
    captures: normalizeCaptures(raw.captures),
    toMove: normalizeColor(raw.toMove ?? raw.to_move),
    legalMoves,
    consecutivePasses: raw.consecutivePasses ?? raw.consecutive_passes ?? 0,
    config: normalizeConfig(raw.config),
    moveCount: raw.moveCount ?? raw.move_count ?? 0,
  };
}

function normalizeOutcome(raw: any): MoveOutcome {
  const board = normalizeBoard(raw.board);
  const legalMoves = normalizePoints(raw.legalMoves ?? raw.legal_moves);
  const lastMove = raw.lastMove ?? raw.last_move;
  return {
    board,
    captures: normalizeCaptures(raw.captures),
    toMove: normalizeColor(raw.toMove ?? raw.to_move),
    gameOver: Boolean(raw.gameOver ?? raw.game_over ?? false),
    consecutivePasses: raw.consecutivePasses ?? raw.consecutive_passes ?? 0,
    legalMoves,
    lastMove: {
      mv: {
        color: normalizeColor(lastMove?.mv?.color ?? lastMove?.move?.color ?? "black"),
        point: lastMove?.mv?.point
          ? normalizePoint(lastMove.mv.point)
          : lastMove?.move?.point
            ? normalizePoint(lastMove.move.point)
            : null,
      },
      captured: normalizePoints(lastMove?.captured),
      moveNumber: lastMove?.moveNumber ?? lastMove?.move_number ?? 0,
    },
  } as MoveOutcome;
}

function normalizeBoard(raw: any): GameStateSnapshot["board"] {
  const size = raw?.size ?? 19;
  const intersections = Array.isArray(raw?.intersections)
    ? raw.intersections.map((value: unknown) =>
        value === null ? null : (normalizeColor(value) as StoneColor),
      )
    : Array(size * size).fill(null);
  return { size, intersections };
}

function normalizeConfig(raw: any | undefined): GameConfig {
  if (!raw) {
    return { size: 19, komi: 6.5, superko: true };
  }
  return {
    size: raw.size ?? raw.boardSize ?? 19,
    komi: Number(raw.komi ?? 6.5),
    superko: raw.superko ?? raw.superKo ?? true,
  };
}

function normalizeCaptures(raw: any | undefined) {
  return {
    black: raw?.black ?? raw?.black_captures ?? 0,
    white: raw?.white ?? raw?.white_captures ?? 0,
  };
}

function normalizePoints(raw: any): PointPayload[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((point) => normalizePoint(point));
}

function normalizePoint(raw: any): PointPayload {
  return {
    x: Number(raw?.x ?? raw?.X ?? 0),
    y: Number(raw?.y ?? raw?.Y ?? 0),
  };
}

function normalizeColor(raw: any): StoneColor {
  if (typeof raw === "string") {
    const lower = raw.toLowerCase();
    return lower === "white" ? "white" : "black";
  }
  return "black";
}
