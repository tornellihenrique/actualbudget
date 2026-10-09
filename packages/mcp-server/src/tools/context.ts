import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { AuditLog } from '#audit';
import type { BudgetSession } from '#budget';
import type { JobReport } from '#jobs';

export type ToolContext = {
  session: BudgetSession;
  audit: AuditLog;
  lastDailyJob: () => JobReport | null;
};

/** Each tool module contributes its tools through one of these. */
export type ToolRegistrar = (server: McpServer, ctx: ToolContext) => void;
