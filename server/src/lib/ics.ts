export interface IcsEventInput {
  uid: string;
  summary: string;
  description: string;
  startIso: string;
  durationMinutes: number;
  dtstampIso: string;
}

function formatIcsTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number, w = 2) => n.toString().padStart(w, '0');
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export function buildIcsEvent(input: IcsEventInput): string {
  const endIso = new Date(
    new Date(input.startIso).getTime() + input.durationMinutes * 60_000,
  ).toISOString();

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//study-app//mock-interviews//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${input.uid}`,
    `DTSTAMP:${formatIcsTime(input.dtstampIso)}`,
    `DTSTART:${formatIcsTime(input.startIso)}`,
    `DTEND:${formatIcsTime(endIso)}`,
    `SUMMARY:${escapeText(input.summary)}`,
    `DESCRIPTION:${escapeText(input.description)}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.join('\r\n') + '\r\n';
}
