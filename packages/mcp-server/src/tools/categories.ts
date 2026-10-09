import * as api from '@actual-app/api';
import { z } from 'zod';

import type { ToolRegistrar } from './context';
import { jsonResult } from './format';
import { loadLookups } from './lookups';

const operation = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('create_category'),
    name: z.string(),
    group: z.string().describe('Group name or id'),
  }),
  z.object({
    op: z.literal('create_group'),
    name: z.string(),
    is_income: z.boolean().optional(),
  }),
  z.object({
    op: z.literal('rename_category'),
    category: z.string(),
    name: z.string(),
  }),
  z.object({
    op: z.literal('rename_group'),
    group: z.string(),
    name: z.string(),
  }),
  z.object({
    op: z.literal('move_category'),
    category: z.string(),
    group: z.string(),
  }),
  z.object({
    op: z.literal('set_hidden'),
    category: z.string(),
    hidden: z.boolean(),
  }),
  z.object({
    op: z.literal('delete_category'),
    category: z.string(),
    transfer_to: z
      .string()
      .optional()
      .describe('Category that receives its transactions and budget'),
  }),
]);

export const registerCategoryTools: ToolRegistrar = (server, ctx) => {
  server.registerTool(
    'list_categories',
    {
      title: 'List categories',
      description: 'Category groups and their categories, with ids.',
      inputSchema: {
        include_hidden: z.boolean().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    ({ include_hidden }) =>
      ctx.session.read(async () => {
        const groups = await api.getCategoryGroups({ hidden: include_hidden });
        return jsonResult(
          groups.map(g => ({
            id: g.id,
            group: g.name,
            is_income: g.is_income,
            ...(g.hidden ? { hidden: true } : {}),
            categories: (g.categories ?? []).map(c => ({
              id: c.id,
              name: c.name,
              ...(c.hidden ? { hidden: true } : {}),
            })),
          })),
        );
      }),
  );

  server.registerTool(
    'manage_categories',
    {
      title: 'Manage categories',
      description:
        'Create, rename, move, hide or delete categories and groups. Operations run in order.',
      inputSchema: { operations: z.array(operation).min(1).max(50) },
    },
    ({ operations }) =>
      ctx.session.write(async () => {
        const done: string[] = [];
        for (const operation of operations) {
          const lookups = await loadLookups();
          switch (operation.op) {
            case 'create_category': {
              const id = await api.createCategory({
                name: operation.name,
                group_id: lookups.groupId(operation.group),
              });
              done.push(`created category ${operation.name} (${id})`);
              break;
            }
            case 'create_group': {
              const id = await api.createCategoryGroup({
                name: operation.name,
                is_income: operation.is_income ?? false,
              });
              done.push(`created group ${operation.name} (${id})`);
              break;
            }
            case 'rename_category':
              await api.updateCategory(lookups.categoryId(operation.category), {
                name: operation.name,
              });
              done.push(`renamed ${operation.category} to ${operation.name}`);
              break;
            case 'rename_group':
              await api.updateCategoryGroup(lookups.groupId(operation.group), {
                name: operation.name,
              });
              done.push(
                `renamed group ${operation.group} to ${operation.name}`,
              );
              break;
            case 'move_category':
              await api.updateCategory(lookups.categoryId(operation.category), {
                group_id: lookups.groupId(operation.group),
              });
              done.push(`moved ${operation.category} to ${operation.group}`);
              break;
            case 'set_hidden':
              await api.updateCategory(lookups.categoryId(operation.category), {
                hidden: operation.hidden,
              });
              done.push(
                `${operation.hidden ? 'hid' : 'unhid'} ${operation.category}`,
              );
              break;
            case 'delete_category':
              await api.deleteCategory(
                lookups.categoryId(operation.category),
                operation.transfer_to
                  ? lookups.categoryId(operation.transfer_to)
                  : undefined,
              );
              done.push(`deleted ${operation.category}`);
              break;
            default:
              throw new Error('Unknown operation');
          }
        }
        ctx.audit.record({
          tool: 'manage_categories',
          summary: done.join('; '),
          details: operations,
        });
        return jsonResult({ done });
      }),
  );
};
