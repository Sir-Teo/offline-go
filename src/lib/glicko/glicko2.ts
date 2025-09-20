import { z } from "zod";

const DEFAULT_RATING = 1500;
const DEFAULT_RD = 350;
const DEFAULT_VOLATILITY = 0.06;
const SCALE = 173.7178;
const Q = Math.log(10) / 400;

export const RatingSchema = z.object({
  rating: z.number(),
  deviation: z.number(),
  volatility: z.number(),
});

export type Rating = z.infer<typeof RatingSchema>;

export interface OpponentResult {
  opponent: Rating;
  score: 0 | 0.5 | 1;
  weight?: number;
}

export interface GlickoConfig {
  tau: number;
  defaultRating: number;
  defaultDeviation: number;
  defaultVolatility: number;
}

export interface RatingUpdate extends Rating {
  ratingDelta: number;
  deviationDelta: number;
  volatilityDelta: number;
}

const DEFAULT_CONFIG: GlickoConfig = {
  tau: 0.5,
  defaultRating: DEFAULT_RATING,
  defaultDeviation: DEFAULT_RD,
  defaultVolatility: DEFAULT_VOLATILITY,
};

function g(phi: number): number {
  return 1 / Math.sqrt(1 + ((3 * Q ** 2 * phi ** 2) / Math.PI ** 2));
}

function e(mu: number, muJ: number, phiJ: number): number {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));
}

function toMu(rating: number, defaultRating: number): number {
  return (rating - defaultRating) / SCALE;
}

function toPhi(rd: number): number {
  return rd / SCALE;
}

function fromMu(mu: number, defaultRating: number): number {
  return mu * SCALE + defaultRating;
}

function fromPhi(phi: number): number {
  return phi * SCALE;
}

function volatilityIteration(
  phi: number,
  delta: number,
  v: number,
  sigma: number,
  tau: number,
): number {
  const a = Math.log(sigma ** 2);
  let A = a;
  let B: number;

  const deltaSquared = delta ** 2;
  const phiSquared = phi ** 2;

  if (deltaSquared > phiSquared + v) {
    B = Math.log(deltaSquared - phiSquared - v);
  } else {
    let k = 1;
    do {
      B = a - k * tau;
      k += 1;
    } while (f(B, delta, phi, v, a, tau) < 0);
  }

  let fA = f(A, delta, phi, v, a, tau);
  let fB = f(B, delta, phi, v, a, tau);

  while (Math.abs(B - A) > 1e-6) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C, delta, phi, v, a, tau);
    if (fC * fB < 0) {
      A = B;
      fA = fB;
    }
    B = C;
    fB = fC;
  }

  return Math.exp(A / 2);
}

function f(
  x: number,
  delta: number,
  phi: number,
  v: number,
  a: number,
  tau: number,
): number {
  const ex = Math.exp(x);
  const numerator = ex * (delta ** 2 - phi ** 2 - v - ex);
  const denominator = 2 * (phi ** 2 + v + ex) ** 2;
  return numerator / denominator - (x - a) / (tau ** 2);
}

export function ratePlayer(
  current: Rating,
  opponents: OpponentResult[],
  config: Partial<GlickoConfig> = {},
): RatingUpdate {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const rating = current.rating ?? cfg.defaultRating;
  const deviation = current.deviation ?? cfg.defaultDeviation;
  const volatility = current.volatility ?? cfg.defaultVolatility;

  const mu = toMu(rating, cfg.defaultRating);
  const phi = toPhi(deviation);

  if (opponents.length === 0) {
    const phiPrime = Math.sqrt(phi ** 2 + volatility ** 2);
    return {
      rating,
      deviation: fromPhi(phiPrime),
      volatility,
      ratingDelta: 0,
      deviationDelta: fromPhi(phiPrime) - deviation,
      volatilityDelta: 0,
    };
  }

  const summaries = opponents.map((match) => {
    const opp = RatingSchema.parse(match.opponent);
    const muJ = toMu(opp.rating, cfg.defaultRating);
    const phiJ = toPhi(opp.deviation);
    const weight = match.weight ?? 1;
    const gPhi = g(phiJ);
    const exp = e(mu, muJ, phiJ);
    return { gPhi, exp, score: match.score, weight };
  });

  const v = 1 /
    summaries.reduce(
      (sum, { gPhi, exp, weight }) => sum + weight * gPhi ** 2 * exp * (1 - exp),
      0,
    );

  const delta = v * summaries.reduce(
    (sum, { gPhi, exp, score, weight }) => sum + weight * gPhi * (score - exp),
    0,
  );

  const sigmaPrime = volatilityIteration(phi, delta, v, volatility, cfg.tau);
  const phiStar = Math.sqrt(phi ** 2 + sigmaPrime ** 2);
  const phiPrime = 1 /
    Math.sqrt(1 / (phiStar ** 2) + (1 / v));
  const muPrime = mu + phiPrime ** 2 * summaries.reduce(
    (sum, { gPhi, exp, score, weight }) => sum + weight * gPhi * (score - exp),
    0,
  );

  const newRating = fromMu(muPrime, cfg.defaultRating);
  const newDeviation = fromPhi(phiPrime);

  return {
    rating: newRating,
    deviation: newDeviation,
    volatility: sigmaPrime,
    ratingDelta: newRating - rating,
    deviationDelta: newDeviation - deviation,
    volatilityDelta: sigmaPrime - volatility,
  };
}

export function advanceRatingPeriod(current: Rating, volatility: number = current.volatility): Rating {
  return {
    rating: current.rating,
    deviation: Math.sqrt(current.deviation ** 2 + volatility ** 2),
    volatility,
  };
}

export function expectedScore(player: Rating, opponent: Rating): number {
  const mu = toMu(player.rating, DEFAULT_RATING);
  const muJ = toMu(opponent.rating, DEFAULT_RATING);
  const phiJ = toPhi(opponent.deviation);
  return e(mu, muJ, phiJ);
}
