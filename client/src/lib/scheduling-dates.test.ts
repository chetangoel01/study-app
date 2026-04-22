import { describe, it, expect } from 'vitest';
import { formatInZone, getZoneAbbrev, groupByDay, isPast } from './scheduling-dates.js';

describe('formatInZone', () => {
  it('renders the time in the given IANA zone', () => {
    // 2026-06-15T19:00:00Z is 15:00 EDT in America/New_York (DST active)
    const out = formatInZone('2026-06-15T19:00:00.000Z', 'America/New_York');
    expect(out).toMatch(/Mon.*Jun 15.*3:00 PM/);
    expect(out).toContain('EDT');
  });

  it('renders different times for different zones', () => {
    const nyc = formatInZone('2026-06-15T19:00:00.000Z', 'America/New_York');
    const ldn = formatInZone('2026-06-15T19:00:00.000Z', 'Europe/London');
    expect(nyc).not.toBe(ldn);
  });

  it('falls back to browser zone on invalid tz without throwing', () => {
    const out = formatInZone('2026-06-15T19:00:00.000Z', 'Not/A_Zone');
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });
});

describe('getZoneAbbrev', () => {
  it('returns EDT vs EST at correct times of year', () => {
    const summer = getZoneAbbrev('2026-06-15T19:00:00.000Z', 'America/New_York');
    const winter = getZoneAbbrev('2026-01-15T19:00:00.000Z', 'America/New_York');
    expect(summer).toBe('EDT');
    expect(winter).toBe('EST');
  });
});

describe('groupByDay', () => {
  const base = (iso: string) => ({
    id: iso,
    direction: 'sent' as const,
    counterparty: { id: 'x', fullName: 'X', initials: 'X' },
    status: 'accepted' as const,
    scheduledFor: iso,
    durationMinutes: 45,
    topic: 't',
    rolePreference: 'either' as const,
    sourceBlockId: null,
    createdAt: '',
    updatedAt: '',
  });

  it('groups events by day in the USER zone, not UTC', () => {
    // 2026-06-15T03:30:00Z is 23:30 on 2026-06-14 in America/New_York (EDT)
    const groups = groupByDay([base('2026-06-15T03:30:00.000Z')], 'America/New_York');
    expect(groups).toHaveLength(1);
    expect(groups[0].dayKey).toBe('2026-06-14');
  });

  it('labels Today / Tomorrow based on user zone', () => {
    const now = new Date();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const tomorrow = new Date(now.getTime() + 86_400_000).toISOString();
    const groups = groupByDay([base(now.toISOString()), base(tomorrow)], tz);
    expect(groups[0].label).toBe('Today');
    expect(groups[1].label).toBe('Tomorrow');
  });

  it('preserves ascending order of events within a day', () => {
    const groups = groupByDay(
      [
        base('2026-06-15T20:00:00.000Z'),
        base('2026-06-15T15:00:00.000Z'),
      ],
      'America/New_York',
    );
    expect(groups[0].items.map((i) => i.scheduledFor)).toEqual([
      '2026-06-15T15:00:00.000Z',
      '2026-06-15T20:00:00.000Z',
    ]);
  });
});

describe('isPast', () => {
  it('returns true for past ISO', () => {
    expect(isPast(new Date(Date.now() - 60_000).toISOString())).toBe(true);
  });
  it('returns false for future ISO', () => {
    expect(isPast(new Date(Date.now() + 60_000).toISOString())).toBe(false);
  });
});
