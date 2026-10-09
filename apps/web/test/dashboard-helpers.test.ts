import { describe, expect, it } from 'vitest';
import {
  currentLocalMonth,
  formatDelta,
  previousCalendarMonth,
  usableValueCount,
  validDashboardMonth,
} from '../src/dashboard-helpers.js';

describe('dashboard presentation helpers', () => {
  it('uses browser-local calendar fields and validates URL months', () => {
    expect(currentLocalMonth(new Date(2026, 0, 31, 23, 59))).toBe('2026-01');
    expect(validDashboardMonth('bad', '2026-08')).toBe('2026-08');
    expect(validDashboardMonth('2025-12', '2026-08')).toBe('2025-12');
  });
  it('calculates previous month across a year boundary', () =>
    expect(previousCalendarMonth('2025-01')).toBe('2024-12'));
  it('formats positive, negative, unchanged and missing deltas neutrally', () => {
    expect(formatDelta(82.8, 82, 'weight')?.short).toBe('+0.80 kg');
    expect(formatDelta(120, 122, 'pressure')?.short).toBe('−2.0 mmHg');
    expect(formatDelta(1.004, 1.003, 'weight')?.accessible).toBe(
      'No change at displayed precision.',
    );
    expect(formatDelta(null, 1, 'weight')).toBeNull();
    expect(formatDelta(1, null, 'weight')).toBeNull();
  });
  it('formats duration changes and preserves null versus zero in trend state', () => {
    expect(formatDelta(420, 432, 'duration')?.short).toBe('12 min less');
    expect(usableValueCount([null, 0, 2])).toBe(2);
    expect(usableValueCount([null, 1])).toBe(1);
  });
});
