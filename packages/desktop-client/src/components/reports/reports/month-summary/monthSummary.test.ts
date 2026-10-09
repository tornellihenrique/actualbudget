import { describe, expect, it } from 'vitest';

import {
  getProgress,
  getProjectedSavings,
  getSavedSoFar,
} from './monthSummary';

describe('getSavedSoFar', () => {
  it('nets the spending against the income received', () => {
    expect(
      getSavedSoFar({ incomeReceived: 1500000, expensesSpent: -600000 }),
    ).toBe(900000);
  });
});

describe('getProjectedSavings', () => {
  it('assumes the rest of the budgeted income still arrives', () => {
    expect(
      getProjectedSavings({
        incomeReceived: 1500000,
        incomeBudgeted: 2100000,
        expensesBudgeted: 1700000,
        overspent: 0,
      }),
    ).toBe(400000);
  });

  it('counts income received above the budget', () => {
    expect(
      getProjectedSavings({
        incomeReceived: 2200000,
        incomeBudgeted: 2100000,
        expensesBudgeted: 1700000,
        overspent: 0,
      }),
    ).toBe(500000);
  });

  it('subtracts overspending on top of the budgeted expenses', () => {
    expect(
      getProjectedSavings({
        incomeReceived: 2100000,
        incomeBudgeted: 2100000,
        expensesBudgeted: 1700000,
        overspent: -150000,
      }),
    ).toBe(250000);
  });
});

describe('getProgress', () => {
  it('measures spending against its budget', () => {
    expect(getProgress(-850000, 1700000)).toBe(0.5);
  });

  it('treats any amount against an empty target as complete', () => {
    expect(getProgress(1000, 0)).toBe(1);
    expect(getProgress(-1000, 0)).toBe(1);
    expect(getProgress(0, 0)).toBe(0);
  });
});
