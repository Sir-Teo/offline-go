import { EventEmitter } from "eventemitter3";
import { invoke } from "@tauri-apps/api/core";
import { localCache, PendingOperation, PlayerRecordSchema, TournamentRecord, GameRecord, PuzzleRecord } from "./localStore";

export type SyncOperationKind = "upsert" | "delete";

export interface SyncOperationInput {
  entityType: string;
  entityId: string;
  op: SyncOperationKind;
  payload?: unknown;
}

export interface SyncOperationRecord {
  id: string;
  entityType: string;
  entityId: string;
  op: SyncOperationKind;
  payload: unknown;
  version: number;
  createdAt: string;
}

type SyncEvents = {
  queued: [SyncOperationRecord];
  flushed: [SyncOperationRecord[]];
  applied: [SyncOperationRecord[]];
  error: [Error];
};

function nowISO(): string {
  return new Date().toISOString();
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

export class SyncEngine extends EventEmitter<SyncEvents> {
  async queue(operation: SyncOperationInput): Promise<void> {
    const record: PendingOperation = {
      uuid: randomId(),
      entityType: operation.entityType,
      entityId: operation.entityId,
      op: operation.op,
      payload: operation.payload ?? null,
      createdAt: nowISO(),
    };

    const id = await localCache.pendingOps.add(record);
    const queuedRecord: SyncOperationRecord = {
      id: record.uuid,
      entityType: record.entityType,
      entityId: record.entityId,
      op: record.op,
      payload: record.payload,
      version: 0,
      createdAt: record.createdAt,
    };
    this.emit("queued", queuedRecord);
  }

  async flushPending(limit = 32): Promise<SyncOperationRecord[]> {
    const pending = await localCache.pendingOps.orderBy("createdAt").limit(limit).toArray();
    if (!pending.length) {
      return [];
    }

    const payload = pending.map((op) => ({
      id: op.uuid,
      entityType: op.entityType,
      entityId: op.entityId,
      action: op.op,
      payload: op.payload ?? null,
      createdAt: op.createdAt,
    }));

    try {
      const result = await invoke<SyncOperationRecord[]>("push_sync_operations", {
        operations: payload,
      });
      await localCache.pendingOps.bulkDelete(pending.map((op) => op.id!));
      this.emit("flushed", result);
      return result;
    } catch (error) {
      this.emit("error", error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async pullRemote(limit = 64): Promise<SyncOperationRecord[]> {
    const cursor = await localCache.syncCursor.get("sync-version");
    const since = cursor?.version ?? 0;
    try {
      const operations = await invoke<SyncOperationRecord[]>("fetch_sync_operations", {
        since,
        limit,
      });

      if (!operations.length) {
        return [];
      }

      await localCache.transaction("rw", localCache.players, localCache.tournaments, localCache.games, localCache.puzzles, localCache.syncCursor, async () => {
        for (const op of operations) {
          await applyOperation(op);
        }
        const latestVersion = operations[operations.length - 1]?.version ?? since;
        await localCache.syncCursor.put({
          id: "sync-version",
          version: latestVersion,
          updatedAt: nowISO(),
        });
      });

      this.emit("applied", operations);
      return operations;
    } catch (error) {
      this.emit("error", error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}

async function applyOperation(op: SyncOperationRecord): Promise<void> {
  switch (op.entityType) {
    case "player": {
      if (op.op === "delete") {
        await localCache.players.delete(op.entityId);
      } else {
        const parsed = PlayerRecordSchema.parse(op.payload);
        await localCache.players.put({ ...parsed, updatedAt: op.createdAt });
      }
      break;
    }
    case "tournament": {
      if (op.op === "delete") {
        await localCache.tournaments.delete(op.entityId);
      } else {
        const payload = op.payload as TournamentRecord;
        await localCache.tournaments.put({ ...payload, updatedAt: op.createdAt });
      }
      break;
    }
    case "game": {
      if (op.op === "delete") {
        await localCache.games.delete(op.entityId);
      } else {
        const payload = op.payload as GameRecord;
        await localCache.games.put({ ...payload, updatedAt: op.createdAt });
      }
      break;
    }
    case "puzzle": {
      if (op.op === "delete") {
        await localCache.puzzles.delete(op.entityId);
      } else {
        const payload = op.payload as PuzzleRecord;
        await localCache.puzzles.put({ ...payload, updatedAt: op.createdAt });
      }
      break;
    }
    default:
      // unhandled entity type: best effort no-op
      break;
  }
}

export const syncEngine = new SyncEngine();
