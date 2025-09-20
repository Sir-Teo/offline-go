export type StoneColor = "black" | "white";
export type FloatDirection = "up" | "down";

export interface SwissPlayer {
  id: string;
  name?: string;
  score: number;
  rating: number;
  opponents: string[];
  colorHistory: StoneColor[];
  canPlay?: boolean;
}

export interface SwissOptions {
  avoidRematchPenalty?: number;
  colorRepeatPenalty?: number;
  ratingGapWeight?: number;
  scoreGapWeight?: number;
}

export interface SwissPairing {
  table: number;
  black: string;
  white: string;
  float?: FloatDirection;
}

export interface SwissPairingResult {
  pairings: SwissPairing[];
  bye?: string;
  floated: string[];
  penalty: number;
}

const DEFAULT_OPTIONS: Required<SwissOptions> = {
  avoidRematchPenalty: 1000,
  colorRepeatPenalty: 10,
  ratingGapWeight: 0.05,
  scoreGapWeight: 5,
};

type MutablePlayer = SwissPlayer & { originalIndex: number };

interface PairCandidate {
  black: MutablePlayer;
  white: MutablePlayer;
  penalty: number;
  float?: FloatDirection;
  floatPlayer?: string;
}

export function generateSwissPairings(
  roster: SwissPlayer[],
  opts: SwissOptions = {},
): SwissPairingResult {
  const options = { ...DEFAULT_OPTIONS, ...opts };
  const eligible = roster
    .filter((player) => player.canPlay !== false)
    .map((player, index) => ({ ...player, originalIndex: index }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.rating - a.rating;
    });

  const result: SwissPairingResult = {
    pairings: [],
    floated: [],
    penalty: Number.POSITIVE_INFINITY,
  };

  const { workingSet, bye } = detachBye(eligible);
  const search = searchPairings(workingSet, options, []);

  result.pairings = search.pairings.map((pair, idx) => ({
    table: idx + 1,
    black: pair.black.id,
    white: pair.white.id,
    float: pair.float,
  }));
  result.floated = search.floated;
  result.penalty = search.penalty;
  result.bye = bye?.id;

  return result;
}

function detachBye(players: MutablePlayer[]): {
  workingSet: MutablePlayer[];
  bye?: MutablePlayer;
} {
  if (players.length % 2 === 0) {
    return { workingSet: players.slice() };
  }

  const byeCandidate = [...players]
    .reverse()
    .find((player) => !player.opponents.includes("BYE"));

  if (!byeCandidate) {
    return { workingSet: players.slice(), bye: players[players.length - 1] };
  }

  const workingSet = players.filter((p) => p.id !== byeCandidate.id);
  return { workingSet, bye: byeCandidate };
}

interface SearchResult {
  pairings: PairCandidate[];
  penalty: number;
  floated: string[];
}

function searchPairings(
  players: MutablePlayer[],
  options: Required<SwissOptions>,
  floated: string[],
): SearchResult {
  if (players.length === 0) {
    return { pairings: [], penalty: 0, floated };
  }

  const [lead, ...rest] = players;
  const candidates = rest
    .map((candidate) => buildPairCandidate(lead, candidate, options))
    .sort((a, b) => a.penalty - b.penalty);

  let best: SearchResult = { pairings: [], penalty: Number.POSITIVE_INFINITY, floated };

  for (const candidate of candidates) {
    const remaining = rest.filter((p) => p.id !== candidate.white.id);
    const nextFloated = candidate.float && candidate.floatPlayer
      ? [...floated, candidate.floatPlayer]
      : floated;
    const recursion = searchPairings(remaining, options, nextFloated);
    const totalPenalty = recursion.penalty + candidate.penalty;
    if (totalPenalty < best.penalty) {
      best = {
        pairings: [candidate, ...recursion.pairings],
        penalty: totalPenalty,
        floated: recursion.floated,
      };
    }
  }

  if (!Number.isFinite(best.penalty)) {
    // fallback: allow rematches by releasing restriction
    const relaxedCandidates = rest
      .map((candidate) => buildPairCandidate(lead, candidate, options, true))
      .sort((a, b) => a.penalty - b.penalty);

    for (const candidate of relaxedCandidates) {
      const remaining = rest.filter((p) => p.id !== candidate.white.id);
      const recursion = searchPairings(remaining, options, floated);
      const totalPenalty = recursion.penalty + candidate.penalty;
      if (totalPenalty < best.penalty) {
        best = {
          pairings: [candidate, ...recursion.pairings],
          penalty: totalPenalty,
          floated: recursion.floated,
        };
      }
    }
  }

  return best;
}

function buildPairCandidate(
  a: MutablePlayer,
  b: MutablePlayer,
  options: Required<SwissOptions>,
  relaxed = false,
): PairCandidate {
  const alreadyPlayed = a.opponents.includes(b.id) || b.opponents.includes(a.id);
  const rematchPenalty = alreadyPlayed ? options.avoidRematchPenalty : 0;
  if (alreadyPlayed && !relaxed) {
    return {
      black: a,
      white: b,
      penalty: Number.POSITIVE_INFINITY,
    };
  }

  const { assignment, penalty: colorPenalty } = assignColors(a, b, options);
  const scoreGap = Math.abs(a.score - b.score) * options.scoreGapWeight;
  const ratingGap = Math.abs(a.rating - b.rating) * options.ratingGapWeight;

  let float: FloatDirection | undefined;
  let floatPlayer: string | undefined;
  if (a.score > b.score + 0.5) {
    float = "down";
    floatPlayer = a.id;
  } else if (b.score > a.score + 0.5) {
    float = "up";
    floatPlayer = a.id;
  }

  const penalty = rematchPenalty + colorPenalty + scoreGap + ratingGap;
  return { ...assignment, float, floatPlayer, penalty };
}

function assignColors(
  a: MutablePlayer,
  b: MutablePlayer,
  options: Required<SwissOptions>,
): { assignment: { black: MutablePlayer; white: MutablePlayer }; penalty: number } {
  const optionA = colorPenalty(a, "black", options) + colorPenalty(b, "white", options);
  const optionB = colorPenalty(a, "white", options) + colorPenalty(b, "black", options);

  if (optionA <= optionB) {
    return { assignment: { black: a, white: b }, penalty: optionA };
  }
  return { assignment: { black: b, white: a }, penalty: optionB };
}

function colorPenalty(
  player: MutablePlayer,
  color: StoneColor,
  options: Required<SwissOptions>,
): number {
  const history = player.colorHistory;
  if (history.length === 0) return 0;

  const consecutive = countConsecutive(history, color);
  const bias = history.filter((c) => c === "black").length - history.filter((c) => c === "white").length;

  let penalty = consecutive >= 2 ? options.colorRepeatPenalty * consecutive : 0;
  if (color === "black" && bias > 0) {
    penalty += bias;
  }
  if (color === "white" && bias < 0) {
    penalty += Math.abs(bias);
  }

  return penalty;
}

function countConsecutive(history: StoneColor[], color: StoneColor): number {
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i] === color) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}
