import { describe, expect, it } from 'vitest';
import {
  cleanDateString,
  cleanTimeString,
  addMinutesToTime,
  parseBloodPressureCsv,
} from '../src/import-blood-pressure.js';

describe('blood pressure CSV import helpers', () => {
  it('cleans date typo 2919 -> 2019', () => {
    expect(cleanDateString('2919-12-14')).toBe('2019-12-14');
    expect(cleanDateString('2024-10-08')).toBe('2024-10-08');
  });

  it('cleans times with trailing colons or single-digit hours', () => {
    expect(cleanTimeString('20:00: ')).toBe('20:00:00');
    expect(cleanTimeString('6:15')).toBe('06:15:00');
    expect(cleanTimeString('14:30')).toBe('14:30:00');
    expect(cleanTimeString('')).toBe('');
  });

  it('adds minutes to time correctly', () => {
    expect(addMinutesToTime('06:41:00', 1)).toBe('06:42:00');
    expect(addMinutesToTime('23:59:00', 1)).toBe('00:00:00');
  });

  it('parses CSV rows, resolves missing times, and handles null pulse and quoted notes', () => {
    const csv = [
      'Date,Time,Systolic,Diastolic,Pulse,Notes',
      '2024-10-08,6:15,150,85,85,',
      '2020-02-04,20:00: ,124,82,60,',
      '2019-12-14,7:00,143,92,59,',
      '2019-02-08,6:41,132,83,59,Liggande',
      '2019-02-08,,132,86,57,',
      '2019-02-02,17:59,142,94,70,"Efter 3 km, förkyld igen"',
      '2007-10-23,,137,90,,',
    ].join('\n');

    const { readings, warnings } = parseBloodPressureCsv(csv);
    expect(readings.length).toBe(7);

    // Row 1
    expect(readings[0]!.systolic).toBe(150);
    expect(readings[0]!.diastolic).toBe(85);
    expect(readings[0]!.pulse).toBe(85);
    expect(readings[0]!.notes).toBeNull();

    // Row 2 (time cleaned from 20:00: )
    expect(readings[1]!.systolic).toBe(124);

    // Row 4 & 5 (repeat reading on same day has time incremented by 1 minute)
    expect(readings[3]!.measuredAt.getMinutes()).toBe(41);
    expect(readings[4]!.measuredAt.getMinutes()).toBe(42);
    expect(readings[4]!.timeResolvedFrom).toContain(
      'preceding same-day reading',
    );

    // Row 6 (quoted notes with comma)
    expect(readings[5]!.notes).toBe('Efter 3 km, förkyld igen');

    // Row 7 (standalone missing time defaults to 08:00:00, missing pulse is null)
    expect(readings[6]!.measuredAt.getHours()).toBe(8);
    expect(readings[6]!.measuredAt.getMinutes()).toBe(0);
    expect(readings[6]!.pulse).toBeNull();
    expect(readings[6]!.timeResolvedFrom).toBe('default 08:00:00');

    expect(warnings.length).toBe(2);
  });

  it('throws on invalid data rows', () => {
    expect(() =>
      parseBloodPressureCsv(
        'Date,Time,Systolic,Diastolic,Pulse,Notes\n2024-10-08,6:15,80,120,85,\n',
      ),
    ).toThrow('Systolic (80) must be greater than diastolic (120)');
  });
});
