import { describe, expect, it } from 'vitest';

import {
  getMonthFigure,
  getProgress,
  getProjectedExpenses,
  getProjectedIncome,
  getProjectedSavings,
  getSavedSoFar,
} from './monthSummary';
import type { TrackingMonthTotals } from './monthSummary';

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

describe('getProjectedIncome', () => {
  it('expects the budgeted income until more than that arrives', () => {
    expect(
      getProjectedIncome({ incomeReceived: 1500000, incomeBudgeted: 2100000 }),
    ).toBe(2100000);
    expect(
      getProjectedIncome({ incomeReceived: 2200000, incomeBudgeted: 2100000 }),
    ).toBe(2200000);
  });
});

describe('getProjectedExpenses', () => {
  it('adds overspending to the budgeted expenses', () => {
    expect(
      getProjectedExpenses({ expensesBudgeted: 1700000, overspent: -150000 }),
    ).toBe(1850000);
  });
});

describe('getMonthFigure', () => {
  // The real October 2026 totals. Overspent leaves out rollover categories,
  // as useOverspentCategories does.
  const october: TrackingMonthTotals = {
    incomeReceived: 1483265,
    incomeBudgeted: 2100000,
    expensesSpent: -630896,
    expensesBudgeted: 1811900,
    overspent: -20207,
  };

  it('projects income, expenses and savings for the month', () => {
    expect(getMonthFigure('projected-income', october)).toEqual({
      value: 2100000,
      detail: { kind: 'received-so-far', amount: 1483265 },
    });
    expect(getMonthFigure('projected-expenses', october)).toEqual({
      value: -1832107,
      detail: { kind: 'spent-so-far', amount: 630896 },
    });
    expect(getMonthFigure('projected-savings', october)).toEqual({
      value: 267893,
      detail: { kind: 'saved-so-far', amount: 852369 },
    });
  });

  it('reports what has been realized so far', () => {
    expect(getMonthFigure('income-received', october).value).toBe(1483265);
    expect(getMonthFigure('spent', october)).toEqual({
      value: -630896,
      detail: { kind: 'of-budgeted', amount: 1811900 },
    });
    expect(getMonthFigure('saved-so-far', october)).toEqual({
      value: 852369,
      detail: { kind: 'projected', amount: 267893 },
    });
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
