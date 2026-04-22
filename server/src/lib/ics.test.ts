import { describe, it, expect } from 'vitest';
import { buildIcsEvent } from './ics.js';

describe('buildIcsEvent', () => {
  const sample = {
    uid: 'mock-invite-42@studyapp',
    summary: 'Mock interview with Alice',
    description: 'Topic: System design',
    startIso: '2026-04-23T19:00:00.000Z',
    durationMinutes: 45,
    dtstampIso: '2026-04-21T18:00:00.000Z',
  };

  it('uses CRLF line endings per RFC 5545', () => {
    const body = buildIcsEvent(sample);
    const lines = body.split('\r\n');
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(body).not.toMatch(/[^\r]\n/);
  });

  it('includes all required fields', () => {
    const body = buildIcsEvent(sample);
    expect(body).toContain('VERSION:2.0');
    expect(body).toContain('PRODID:-//study-app//mock-interviews//EN');
    expect(body).toContain('BEGIN:VEVENT');
    expect(body).toContain('UID:mock-invite-42@studyapp');
    expect(body).toContain('DTSTAMP:20260421T180000Z');
    expect(body).toContain('DTSTART:20260423T190000Z');
    expect(body).toContain('DTEND:20260423T194500Z');
    expect(body).toContain('SUMMARY:Mock interview with Alice');
    expect(body).toContain('STATUS:CONFIRMED');
    expect(body).toContain('END:VEVENT');
    expect(body).toContain('END:VCALENDAR');
  });

  it('computes DTEND from duration correctly', () => {
    const body = buildIcsEvent({ ...sample, durationMinutes: 60 });
    expect(body).toContain('DTEND:20260423T200000Z');
  });

  it('escapes commas, semicolons, backslashes, and newlines in text fields', () => {
    const body = buildIcsEvent({
      ...sample,
      summary: 'A, B; C\\ D\nE',
      description: 'x,y;z\\\nq',
    });
    expect(body).toContain('SUMMARY:A\\, B\\; C\\\\ D\\nE');
    expect(body).toContain('DESCRIPTION:x\\,y\\;z\\\\\\nq');
  });

  it('produces a stable UID across repeated calls with same input', () => {
    const a = buildIcsEvent(sample);
    const b = buildIcsEvent(sample);
    expect(a).toBe(b);
  });
});
