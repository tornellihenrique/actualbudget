import * as api from '@actual-app/api';
import { z } from 'zod';

import type { ToolRegistrar } from './context';
import { jsonResult } from './format';

// Stored as an Actual note so it syncs, exports and backs up with the budget
// itself. Notes with ids that match no entity are not shown in the app.
export const NOTEBOOK_NOTE_ID = 'mcp-notebook';

export function replaceSection(
  notebook: string,
  heading: string,
  content: string,
) {
  const lines = notebook.split('\n');
  const title = `## ${heading.replace(/^#+\s*/, '').trim()}`;
  const start = lines.findIndex(l => l.trim() === title);
  const contentLines = content.trim().split('\n');
  const body = (
    contentLines[0].trim() === title ? contentLines.slice(1) : contentLines
  )
    .join('\n')
    .trim();
  const section = `${title}\n\n${body}\n`;
  if (start === -1) return `${notebook.trimEnd()}\n\n${section}`.trimStart();
  const rest = lines.slice(start + 1);
  const offset = rest.findIndex(l => /^##?\s/.test(l));
  const end = offset === -1 ? lines.length : start + 1 + offset;
  return [...lines.slice(0, start), section, ...lines.slice(end)].join('\n');
}

export const registerNotebookTools: ToolRegistrar = (server, ctx) => {
  server.registerTool(
    'read_notebook',
    {
      title: "Read the manager's notebook",
      description:
        'The standing notes for managing this budget: what each category means, conventions for rules, people and accounts, decisions already made, open questions. Read it at the start of any session before changing anything.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    () =>
      ctx.session.read(async () => {
        const note = await api.getNote(NOTEBOOK_NOTE_ID);
        return {
          content: [
            { type: 'text', text: note?.note || '(The notebook is empty.)' },
          ],
        };
      }),
  );

  server.registerTool(
    'update_notebook',
    {
      title: "Update the manager's notebook",
      description:
        'Record conventions and decisions so future sessions, on any device, follow them. Prefer replacing a single "## " section over rewriting the whole notebook. Keep it concise and current; remove things that are no longer true.',
      inputSchema: {
        mode: z.enum(['replace_section', 'append', 'replace_all']),
        section: z
          .string()
          .optional()
          .describe('Heading text, for replace_section'),
        content: z.string(),
      },
    },
    ({ mode, section, content }) =>
      ctx.session.write(async () => {
        const before = (await api.getNote(NOTEBOOK_NOTE_ID))?.note ?? '';
        let after: string;
        if (mode === 'replace_all') {
          after = content.trim() + '\n';
        } else if (mode === 'append') {
          after = `${before.trimEnd()}\n\n${content.trim()}\n`.trimStart();
        } else {
          if (!section) throw new Error('section is required.');
          after = replaceSection(before, section, content);
        }
        await api.updateNote(NOTEBOOK_NOTE_ID, after);
        ctx.audit.record({
          tool: 'update_notebook',
          summary: `${mode}${section ? ` "${section}"` : ''}`,
          details: { before },
        });
        return jsonResult({ saved: true, length: after.length });
      }),
  );
};
