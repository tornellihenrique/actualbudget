import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

function userPrompt(text: string) {
  return {
    messages: [
      { role: 'user' as const, content: { type: 'text' as const, text } },
    ],
  };
}

export function registerPrompts(server: McpServer) {
  server.registerPrompt(
    'weekly_review',
    {
      title: 'Weekly review',
      description:
        'Bring the budget up to date and report what needs attention.',
    },
    () =>
      userPrompt(
        [
          'Run my weekly finance review in Actual.',
          '1. Read the notebook, then get the overview. If an account has not synced in over two days, run bank_sync; if a bank connection has expired, tell me which one to reconnect.',
          '2. Categorize uncategorized transactions using the notebook conventions. Do the confident ones directly; when a merchant recurs, add it to the matching rule instead of only fixing the transaction. Ask me only about the ones you cannot infer, in one compact list with your best guess for each.',
          '3. Check schedules: link payments that arrived but were not matched, and tell me about anything genuinely unpaid.',
          '4. Look for duplicates and unlinked card payments.',
          '5. Finish with a short summary: spending this month versus last month by group, anything unusual, and what you changed. Record new decisions in the notebook.',
        ].join('\n'),
      ),
  );

  server.registerPrompt(
    'month_close',
    {
      title: 'Close the month',
      description: 'Review a finished month and record what was learned.',
      argsSchema: {
        month: z.string().describe('YYYY-MM').optional(),
      },
    },
    ({ month }) =>
      userPrompt(
        [
          `Close ${month ?? 'last month'} in Actual.`,
          'Make sure every transaction in the month is categorized and every schedule occurrence is paid, skipped or explained.',
          'Then give me: income, spending by group compared with the previous three months, the largest one-off expenses, the balance of any receivables the notebook tracks, and one or two concrete suggestions.',
          'Save a short summary of the month in the notebook.',
        ].join('\n'),
      ),
  );
}
