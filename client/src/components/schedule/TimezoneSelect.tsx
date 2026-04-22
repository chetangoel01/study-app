const COMMON_ZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

function allZones(): string[] {
  const intlObj = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
  if (typeof intlObj.supportedValuesOf === 'function') {
    return intlObj.supportedValuesOf('timeZone');
  }
  return COMMON_ZONES;
}

interface Props {
  value: string;
  onChange: (tz: string) => void;
  id?: string;
}

export function TimezoneSelect({ value, onChange, id }: Props) {
  const zones = allZones();
  const merged = Array.from(new Set([...COMMON_ZONES, ...zones]));
  return (
    <select
      id={id}
      className="timezone-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {merged.map((tz) => (
        <option key={tz} value={tz}>{tz}</option>
      ))}
    </select>
  );
}
