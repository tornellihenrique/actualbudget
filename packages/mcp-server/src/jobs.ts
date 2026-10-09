import fs from 'fs';

import type { Backups } from '#backups';
import { syncBankAccounts } from '#bank-sync';
import type { BankSyncResult } from '#bank-sync';
import type { BudgetSession } from '#budget';

export type JobReport = {
  ranAt: string;
  backup?: string;
  bankSync?: BankSyncResult[];
  error?: string;
};

export type DailyJob = {
  last(): JobReport | null;
  runNow(): Promise<JobReport>;
  stop(): void;
};

export type DailyJobOptions = {
  session: BudgetSession;
  backups: Backups;
  reportFile: string;
  hour: number;
  bankSync: boolean;
  log: (message: string) => void;
};

function msUntilHour(hour: number, now = new Date()) {
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

// Keeps the budget current without anyone opening the app: Actual only pulls
// from banks when a client asks it to.
export function startDailyJob({
  session,
  backups,
  reportFile,
  hour,
  bankSync,
  log,
}: DailyJobOptions): DailyJob {
  let lastReport: JobReport | null = fs.existsSync(reportFile)
    ? (JSON.parse(fs.readFileSync(reportFile, 'utf8')) as JobReport)
    : null;
  let timer: NodeJS.Timeout | undefined;

  async function run(): Promise<JobReport> {
    const report: JobReport = { ranAt: new Date().toISOString() };
    try {
      report.backup = await session.read(() => backups.snapshot('daily'));
      if (bankSync) {
        report.bankSync = await session.write(lib => syncBankAccounts(lib));
      }
    } catch (error) {
      report.error = error instanceof Error ? error.message : String(error);
    }
    lastReport = report;
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 1));
    log(`daily job: ${JSON.stringify(report)}`);
    return report;
  }

  function schedule() {
    timer = setTimeout(() => {
      void run().finally(schedule);
    }, msUntilHour(hour));
  }

  schedule();

  return {
    last: () => lastReport,
    runNow: run,
    stop: () => clearTimeout(timer),
  };
}
