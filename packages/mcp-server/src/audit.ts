import fs from 'fs';
import path from 'path';

export type AuditEntry = {
  at: string;
  tool: string;
  summary: string;
  details?: unknown;
};

export type AuditLog = {
  record(entry: Omit<AuditEntry, 'at'>): void;
  recent(limit: number): AuditEntry[];
};

// Append-only JSONL so every change made through the connector can be traced
// and, from the recorded `before` values, reverted by hand.
export function createAuditLog(file: string): AuditLog {
  fs.mkdirSync(path.dirname(file), { recursive: true });

  return {
    record(entry) {
      const line: AuditEntry = { at: new Date().toISOString(), ...entry };
      fs.appendFileSync(file, JSON.stringify(line) + '\n', { mode: 0o600 });
    },
    recent(limit) {
      if (!fs.existsSync(file)) return [];
      const lines = fs.readFileSync(file, 'utf8').trimEnd().split('\n');
      return lines
        .slice(-limit)
        .filter(Boolean)
        .map(line => JSON.parse(line) as AuditEntry)
        .reverse();
    },
  };
}
