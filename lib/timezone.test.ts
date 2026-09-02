import { describe, expect, it } from 'vitest';
import { formatInTimezone, timezoneOffsetLabel, zonedLocalToUtcISO } from '@/lib/timezone';

describe('zonedLocalToUtcISO', () => {
  it('converts wall time in UTC+1 to the correct UTC instant', () => {
    // 13:00 à Douala (UTC+1) = 12:00 UTC.
    expect(zonedLocalToUtcISO('2026-09-02T13:00', 'Africa/Douala')).toBe('2026-09-02T12:00:00.000Z');
  });

  it('keeps UTC unchanged', () => {
    expect(zonedLocalToUtcISO('2026-09-02T09:00', 'UTC')).toBe('2026-09-02T09:00:00.000Z');
  });

  it('handles negative offsets', () => {
    // 09:00 à New York (UTC-4 en été) = 13:00 UTC.
    expect(zonedLocalToUtcISO('2026-07-02T09:00', 'America/New_York')).toBe('2026-07-02T13:00:00.000Z');
  });
});

describe('formatInTimezone', () => {
  it('formats in the requested zone', () => {
    const iso = '2026-09-02T12:00:00.000Z';
    expect(formatInTimezone(iso, 'UTC')).toContain('2026');
    expect(formatInTimezone(iso, 'Africa/Douala')).toContain('13:00');
    expect(formatInTimezone(iso, 'UTC')).toContain('12:00');
  });

  it('returns a dash for empty values', () => {
    expect(formatInTimezone(null, 'UTC')).toBe('—');
    expect(formatInTimezone(undefined, 'UTC')).toBe('—');
  });
});

describe('timezoneOffsetLabel', () => {
  it('labels common offsets', () => {
    expect(timezoneOffsetLabel('UTC')).toBe('UTC');
    const douala = timezoneOffsetLabel('Africa/Douala');
    expect(douala).toMatch(/^UTC\+1$/);
  });
});
