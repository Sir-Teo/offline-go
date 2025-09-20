import Dexie, { Table } from "dexie";
import { z } from "zod";

export const PlayerRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string().optional(),
  rating: z.number().default(1500),
  ratingDeviation: z.number().default(350),
  ratingVolatility: z.number().default(0.06),
  rank: z.number().int().optional(),
  federationId: z.string().optional(),
  updatedAt: z.string(),
});

export type PlayerRecord = z.infer<typeof PlayerRecordSchema>;

export interface TournamentRecord {
  id: string;
  name: string;
  boardSize: number;
  rounds: number;
  startsAt?: string;
  status: "draft" | "running" | "completed";
  updatedAt: string;
}

export interface GameRecord {
  id: string;
  blackPlayerId?: string;
  whitePlayerId?: string;
  result?: string;
  boardSize: number;
  komi: number;
  handicap: number;
  playedAt?: string;
  tournamentId?: string;
  roundIndex?: number;
  updatedAt: string;
}

export interface PuzzleRecord {
  id: string;
  name: string;
  source?: string;
  difficulty?: number;
  tags?: string[];
  digest: string;
  updatedAt: string;
}

export interface PendingOperation {
  id?: number;
  uuid: string;
  entityType: string;
  entityId: string;
  op: "upsert" | "delete";
  payload: unknown;
  createdAt: string;
}


export interface SyncCursor {
  id: string;
  version: number;
  updatedAt: string;
}

export class OfflineGoCache extends Dexie {
  players!: Table<PlayerRecord>;
  tournaments!: Table<TournamentRecord>;
  games!: Table<GameRecord>;
  puzzles!: Table<PuzzleRecord>;
  pendingOps!: Table<PendingOperation>;
  syncCursor!: Table<SyncCursor>;

  constructor() {
    super("offline-go-cache");
    this.version(1).stores({
      players: "id, updatedAt, rating",
      tournaments: "id, status, updatedAt",
      games: "id, tournamentId, roundIndex, updatedAt",
      puzzles: "id, digest, updatedAt",
      pendingOps: "++id, createdAt, entityType, entityId",
      syncCursor: "id",
    });
  }
}

export const localCache = new OfflineGoCache();
