import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createGame,
  GameStateSnapshot,
  MoveOutcome,
  MoveRecordSnapshot,
  ScoreSummary,
  playMove,
  PointPayload,
  scoreGame,
  StoneColor,
} from "../lib/rules";

interface GoGameState {
  snapshot?: GameStateSnapshot;
  lastOutcome?: MoveOutcome;
  history: MoveRecordSnapshot[];
  scoreSummary?: ScoreSummary;
  loading: boolean;
  error?: string;
}

export function useGoGameSession(size: number = 19, seed: number = 0) {
  const [state, setState] = useState<GoGameState>({ loading: true, history: [] });
  const [gameId, setGameId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setGameId(null);
    setState({ loading: true, history: [] });
    async function boot() {
      try {
        const snapshot = await createGame({ size });
        if (cancelled) return;
        setGameId(snapshot.gameId);
        setState({ snapshot, lastOutcome: undefined, history: [], scoreSummary: undefined, loading: false });
      } catch (err) {
        console.error("create game failed", err);
        if (!cancelled) {
          setState({ loading: false, history: [], error: err instanceof Error ? err.message : String(err) });
        }
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [size, seed]);

  const playAt = useCallback(
    async (point: PointPayload | null) => {
      if (!gameId || state.loading) return;
      const snapshot = state.snapshot;
      if (!snapshot) {
        setState((prev) => ({ ...prev, error: "Game state missing" }));
        return;
      }

      setState((prev) => ({ ...prev, loading: true }));
      try {
        const outcome = await playMove(gameId, snapshot.toMove, point);
        setState((prev) => ({
          snapshot: {
            gameId,
            board: outcome.board,
            captures: outcome.captures,
            toMove: outcome.toMove,
            legalMoves: outcome.legalMoves,
            consecutivePasses: outcome.consecutivePasses,
            config: snapshot.config,
            moveCount: outcome.lastMove.moveNumber,
          },
          lastOutcome: outcome,
          history: [...(prev.history ?? []), outcome.lastMove],
          scoreSummary: undefined,
          loading: false,
          error: undefined,
        }));
      } catch (err) {
        console.error("play move failed", err);
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    },
    [gameId, state.loading, state.snapshot],
  );

  const pass = useCallback(() => playAt(null), [playAt]);

  const playStone = useCallback(
    (point: PointPayload) => {
      if (!state.snapshot) return;
      return playAt(point);
    },
    [playAt, state.snapshot],
  );

  const score = useCallback(async () => {
    if (!gameId) return undefined;
    try {
      const summary = await scoreGame(gameId);
      setState((prev) => ({ ...prev, scoreSummary: summary }));
      return summary;
    } catch (err) {
      console.error("score failed", err);
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : String(err),
      }));
      return undefined;
    }
  }, [gameId]);

  const legalSet = useMemo(() => {
    if (!state.snapshot) return new Set<string>();
    return new Set((state.snapshot.legalMoves ?? []).map((pt) => `${pt.x},${pt.y}`));
  }, [state.snapshot]);

  const lastMove = state.lastOutcome?.lastMove;

  return {
    gameId,
    snapshot: state.snapshot,
    lastOutcome: state.lastOutcome,
    history: state.history ?? [],
    scoreSummary: state.scoreSummary,
    loading: state.loading,
    error: state.error,
    playStone,
    pass,
    score,
    canPlay: (point: PointPayload) => legalSet.size === 0 || legalSet.has(`${point.x},${point.y}`),
    toMove: state.snapshot?.toMove ?? ("black" as StoneColor),
    lastMove,
  } as const;
}
