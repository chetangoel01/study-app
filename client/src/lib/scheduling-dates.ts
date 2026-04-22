import type { InviteSummary } from '../types.js';

function safeZone(tz: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
}

export function formatInZone(iso: string, tz: string): string {
  const zone = safeZone(tz);
  const dateFmt = new Intl.DateTimeFormat(undefined, {
    timeZone: zone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timeFmt = new Intl.DateTimeFormat(undefined, {
    timeZone: zone,
    hour: 'numeric',
    minute: '2-digit',
  });
  const d = new Date(iso);
  return `${dateFmt.format(d)} · ${timeFmt.format(d)} ${getZoneAbbrev(iso, zone)}`.trim();
}

export function getZoneAbbrev(iso: string, tz: string): string {
  const zone = safeZone(tz);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    timeZoneName: 'short',
  }).formatToParts(new Date(iso));
  const part = parts.find((p) => p.type === 'timeZoneName');
  return part ? part.value : '';
}

function dayKeyInZone(iso: string, tz: string): string {
  const zone = safeZone(tz);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function dayLabel(dayKey: string, tz: string): string {
  const todayKey = dayKeyInZone(new Date().toISOString(), tz);
  const tomorrow = new Date(Date.now() + 86_400_000);
  const tomorrowKey = dayKeyInZone(tomorrow.toISOString(), tz);
  if (dayKey === todayKey) return 'Today';
  if (dayKey === tomorrowKey) return 'Tomorrow';
  const [y, m, d] = dayKey.split('-').map(Number);
  const sample = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat(undefined, {
    timeZone: tz,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(sample);
}

export function groupByDay(
  invites: InviteSummary[],
  tz: string,
): Array<{ dayKey: string; label: string; items: InviteSummary[] }> {
  const zone = safeZone(tz);
  const sorted = [...invites].sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
  const buckets = new Map<string, InviteSummary[]>();
  for (const inv of sorted) {
    const key = dayKeyInZone(inv.scheduledFor, zone);
    const list = buckets.get(key) ?? [];
    list.push(inv);
    buckets.set(key, list);
  }
  return Array.from(buckets.entries()).map(([dayKey, items]) => ({
    dayKey,
    label: dayLabel(dayKey, zone),
    items,
  }));
}

export function isPast(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}
