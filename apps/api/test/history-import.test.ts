import { describe, expect, it } from 'vitest';

import {
  addCalendarDays,
  boundaryShift,
  localDateAt,
  parseCsv,
  parsePapCsv,
} from '../src/history-import/core.js';

describe('history import helpers', () => {
  it('rejects a stored monthly export instead of interpreting it as detailed PAP', () => {
    expect(() =>
      parsePapCsv('summaryMonth,averageUsageMinutes\n2026-09,420\n'),
    ).toThrow();
  });
  it('parses quoted CSV fields', () => {
    expect(parseCsv('a,b\r\n"x,y","a""b"\r\n')).toEqual([
      ['a', 'b'],
      ['x,y', 'a"b'],
    ]);
  });

  it('maps PAP values and the following health date', () => {
    const csv =
      'session_date,Usage hours,Sleep score,leak_score,mask_session_count,ahi\n2025-12-31,0,83,13,2,0.5\n';
    const result = parsePapCsv(csv);
    expect(result.records[0]?.value).toMatchObject({
      therapyDate: '2025-12-31',
      healthDate: '2026-01-01',
      usageMinutes: 0,
      eventsPerHour: 0.5,
      maskSealScore: 13,
      maskOnOffCount: 2,
      totalScore: 83,
    });
    expect(result.zeroUsage).toEqual([2]);
    expect(result.boundaryShifts).toEqual([
      { sourceRow: 2, from: '2025-12-31', to: '2026-01-01', boundary: 'year' },
    ]);
  });

  it('uses the supplied local offset for OHealth dates', () => {
    expect(localDateAt(Date.parse('2025-01-31T23:30:00Z'), 7200)).toBe(
      '2025-02-01',
    );
  });

  it('classifies month and year shifts', () => {
    expect(boundaryShift(1, '2025-01-31', '2025-02-01')?.boundary).toBe(
      'month',
    );
    expect(boundaryShift(1, '2025-12-31', '2026-01-01')?.boundary).toBe('year');
    expect(
      boundaryShift(1, '2025-01-01', addCalendarDays('2025-01-01', 1)),
    ).toBeNull();
  });
});
