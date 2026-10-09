import fs from 'fs';
import path from 'path';

import * as api from '@actual-app/api';

export type Backups = {
  /** Exports the open budget. Must run inside a budget session callback. */
  snapshot(reason: string): Promise<string>;
  /** Takes one snapshot per calendar day; later calls the same day no-op. */
  ensureDaily(): Promise<void>;
  list(): string[];
};

const PREFIX = 'budget-';

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function createBackups(dir: string, retention: number): Backups {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });

  function list() {
    return fs
      .readdirSync(dir)
      .filter(name => name.startsWith(PREFIX) && name.endsWith('.zip'))
      .sort()
      .reverse();
  }

  function prune() {
    for (const name of list().slice(retention)) {
      fs.rmSync(path.join(dir, name));
    }
  }

  async function snapshot(reason: string) {
    const data = await api.exportBudget();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const slug = reason.replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
    const file = path.join(dir, `${PREFIX}${stamp}-${slug}.zip`);
    fs.writeFileSync(file, data, { mode: 0o600 });
    prune();
    return file;
  }

  return {
    snapshot,
    async ensureDaily() {
      const prefix = `${PREFIX}${today()}`;
      if (!list().some(name => name.startsWith(prefix))) {
        await snapshot('daily');
      }
    },
    list,
  };
}
