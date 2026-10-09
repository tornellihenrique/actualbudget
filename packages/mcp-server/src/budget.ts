import fs from 'fs';

import * as api from '@actual-app/api';

export type Lib = Awaited<ReturnType<typeof api.init>>;

export type BudgetSessionOptions = {
  serverUrl: string;
  password: string;
  syncId?: string;
  dataDir: string;
  syncTtlMs: number;
  beforeWrite?: () => Promise<void>;
};

export type BudgetSession = {
  /** Runs `fn` with the budget loaded, syncing first if the copy is stale. */
  read<T>(fn: (lib: Lib) => Promise<T>): Promise<T>;
  /** Runs `fn` against a freshly synced budget and pushes the result. */
  write<T>(fn: (lib: Lib) => Promise<T>): Promise<T>;
  close(): Promise<void>;
};

async function resolveSyncId(configured?: string): Promise<string> {
  if (configured) return configured;
  const groupIds = [
    ...new Set(
      (await api.getBudgets())
        .map(b => b.groupId)
        .filter((id): id is string => !!id),
    ),
  ];
  if (groupIds.length !== 1) {
    throw new Error(
      `Found ${groupIds.length} budgets on the server; set ACTUAL_SYNC_ID to pick one.`,
    );
  }
  return groupIds[0];
}

async function findLocalBudgetId(syncId: string) {
  const budgets = await api.getBudgets();
  return budgets.find(b => b.id && b.groupId === syncId)?.id;
}

// The API keeps one budget open in global state, so every operation is
// serialized through a single promise chain rather than run concurrently.
export function createBudgetSession(
  options: BudgetSessionOptions,
): BudgetSession {
  let lib: Lib | null = null;
  let lastSyncedAt = 0;
  let queue: Promise<unknown> = Promise.resolve();

  function serialize<T>(fn: () => Promise<T>): Promise<T> {
    const run = queue.then(fn, fn);
    queue = run.catch(() => undefined);
    return run;
  }

  async function open(): Promise<Lib> {
    if (lib) return lib;
    fs.mkdirSync(options.dataDir, { recursive: true });
    const opened = await api.init({
      serverURL: options.serverUrl,
      password: options.password,
      dataDir: options.dataDir,
    });
    try {
      const syncId = await resolveSyncId(options.syncId);
      const localId = await findLocalBudgetId(syncId);
      if (localId) {
        await api.loadBudget(localId);
        await api.sync();
      } else {
        await api.downloadBudget(syncId);
      }
    } catch (error) {
      await api.shutdown().catch(() => undefined);
      throw error;
    }
    lib = opened;
    lastSyncedAt = Date.now();
    return lib;
  }

  async function syncIfStale(force: boolean) {
    if (force || Date.now() - lastSyncedAt >= options.syncTtlMs) {
      await api.sync();
      lastSyncedAt = Date.now();
    }
  }

  return {
    read(fn) {
      return serialize(async () => {
        const opened = await open();
        await syncIfStale(false);
        return fn(opened);
      });
    },
    write(fn) {
      return serialize(async () => {
        const opened = await open();
        await syncIfStale(true);
        await options.beforeWrite?.();
        try {
          return await fn(opened);
        } finally {
          await api.sync();
          lastSyncedAt = Date.now();
        }
      });
    },
    close() {
      return serialize(async () => {
        if (!lib) return;
        lib = null;
        await api.shutdown();
      });
    },
  };
}
