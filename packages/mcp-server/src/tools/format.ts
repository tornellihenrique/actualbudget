import * as api from '@actual-app/api';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export function jsonResult(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 1) }] };
}

/** Amounts cross the tool boundary as decimals in the budget's currency. */
export function toAmount(cents: number) {
  return api.utils.integerToAmount(cents);
}

export function toCents(amount: number) {
  return api.utils.amountToInteger(amount);
}

export function currentDay() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function addDays(day: string, days: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * An inclusive range filter. ActualQL reads only the first operator in an
 * object, so `{ $gte, $lte }` would silently drop the upper bound; the array
 * form is an implicit AND.
 */
export function between<T>(min: T, max: T) {
  return [{ $gte: min }, { $lte: max }];
}
