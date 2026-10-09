import { isRedirectUriAllowed } from './auth/provider';
import { createLoginThrottle } from './auth/throttle';
import { monthsBetween } from './tools/budget';
import { replaceSection } from './tools/notebook';
import { previousPeriod } from './tools/reports';
import { amountRange, scheduleStatus, scoreCandidate } from './tools/schedules';

vi.mock('@actual-app/api', () => ({}));

describe('scheduleStatus', () => {
  const today = '2026-10-09';

  it('counts a payment made up to two days early as paid', () => {
    expect(scheduleStatus('2026-10-10', false, ['2026-10-08'], today)).toBe(
      'paid',
    );
  });

  it('treats an earlier payment as belonging to a previous occurrence', () => {
    expect(scheduleStatus('2026-09-15', false, ['2026-09-11'], today)).toBe(
      'missed',
    );
  });

  it('distinguishes due, upcoming and scheduled', () => {
    expect(scheduleStatus(today, false, [], today)).toBe('due');
    expect(scheduleStatus('2026-10-15', false, [], today)).toBe('upcoming');
    expect(scheduleStatus('2026-11-15', false, [], today)).toBe('scheduled');
  });
});

describe('amountRange', () => {
  it('orders isbetween bounds', () => {
    expect(amountRange({ num1: -5000, num2: -8000 }, 'isbetween')).toEqual({
      min: -8000,
      max: -5000,
    });
  });

  it('widens isapprox by 7.5%', () => {
    expect(amountRange(-22000, 'isapprox')).toEqual({
      min: -23650,
      max: -20350,
    });
  });
});

describe('replaceSection', () => {
  const notebook = '# Notebook\n\n## Rules\n\nold\n\n## People\n\nKaroliny\n';

  it('replaces only the named section', () => {
    const result = replaceSection(notebook, 'Rules', 'new');
    expect(result).toContain('## Rules\n\nnew\n');
    expect(result).not.toContain('old');
    expect(result).toContain('## People\n\nKaroliny');
  });

  it('appends a missing section', () => {
    expect(replaceSection(notebook, 'Taxes', 'DAS')).toMatch(
      /## People\n\nKaroliny\n\n## Taxes\n\nDAS\n$/,
    );
  });
});

describe('isRedirectUriAllowed', () => {
  const allowed = ['https://claude.ai/api/mcp/auth_callback'];

  it('accepts listed URIs and any loopback port', () => {
    expect(isRedirectUriAllowed(allowed[0], allowed)).toBe(true);
    expect(
      isRedirectUriAllowed('http://localhost:53682/callback', allowed),
    ).toBe(true);
  });

  it('rejects other hosts', () => {
    expect(
      isRedirectUriAllowed('https://claude.ai.evil.example/cb', allowed),
    ).toBe(false);
    expect(isRedirectUriAllowed('https://localhost/cb', allowed)).toBe(false);
  });
});

describe('createLoginThrottle', () => {
  it('blocks after the limit until the window passes', () => {
    let now = 0;
    const throttle = createLoginThrottle({
      maxFailures: 2,
      windowMs: 1000,
      now: () => now,
    });
    throttle.recordFailure();
    throttle.recordFailure();
    expect(throttle.allow()).toBe(false);
    now = 1001;
    expect(throttle.allow()).toBe(true);
  });
});

describe('previousPeriod', () => {
  it('compares whole months with whole months', () => {
    expect(previousPeriod('2026-09-01', '2026-09-30')).toEqual({
      start: '2026-08-01',
      end: '2026-08-31',
    });
    expect(previousPeriod('2026-01-01', '2026-03-31')).toEqual({
      start: '2025-10-01',
      end: '2025-12-31',
    });
  });

  it('uses an equal number of days otherwise', () => {
    expect(previousPeriod('2026-09-10', '2026-09-19')).toEqual({
      start: '2026-08-31',
      end: '2026-09-09',
    });
  });
});

describe('scoreCandidate', () => {
  const schedule = {
    payee: 'receita',
    amount: { num1: -10000, num2: -120000 },
    amountOp: 'isbetween',
  };

  it('matches a payment whose bank description names the payee', () => {
    const t = {
      payee: null,
      notes: 'PIX ENVIADO - Cp :00000000-RECEITA FEDERAL',
      amount: -17831,
    };
    expect(
      scoreCandidate(t, schedule, 'Receita Federal'),
    ).toBeGreaterThanOrEqual(3);
  });

  it('ignores an unrelated payment that only fits the amount', () => {
    const t = { payee: 'other', notes: 'SUPERMERCADO', amount: -21653 };
    expect(scoreCandidate(t, schedule, 'Receita Federal')).toBeLessThan(3);
  });
});

describe('monthsBetween', () => {
  it('lists every month of an inclusive range across a year boundary', () => {
    expect(monthsBetween('2026-11', '2027-02')).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
    ]);
  });

  it('rejects a reversed range', () => {
    expect(() => monthsBetween('2027-02', '2026-11')).toThrow();
  });
});
