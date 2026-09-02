/**
 * Timezone helpers for the CRM.
 *
 * The operator picks a timezone in /settings (auto-detected from the browser
 * by default). Campaign scheduling and date displays use that timezone, so a
 * campaign "scheduled for 09:00" means 09:00 in the chosen zone regardless of
 * where the browser thinks it is.
 */

const STORAGE_KEY = 'crm-timezone';

/** Browser-detected IANA timezone, e.g. "Africa/Douala" or "UTC". */
export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Timezone saved by the user, or null when "auto" (use detection). */
export function getTimezoneSetting(): string {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
  } catch {
    // localStorage unavailable — fall through to detection.
  }
  return detectTimezone();
}

export function setTimezoneSetting(timezone: string | null): void {
  try {
    if (!timezone) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, timezone);
  } catch {
    // ignore storage failures
  }
}

export const TIMEZONE_OPTIONS: string[] = [
  'UTC',
  'Africa/Douala',
  'Africa/Lagos',
  'Africa/Abidjan',
  'Africa/Accra',
  'Africa/Dakar',
  'Africa/Casablanca',
  'Africa/Nairobi',
  'Africa/Johannesburg',
  'Europe/Paris',
  'Europe/London',
  'America/New_York',
  'America/Sao_Paulo',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
];

/** Short UTC offset label of a zone at the given instant, e.g. "UTC+1". */
export function timezoneOffsetLabel(timeZone: string, at: Date = new Date()): string {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset',
      hour: '2-digit',
    });
    const parts = dtf.formatToParts(at);
    const name = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
    const label = name === 'GMT' ? 'UTC' : name.replace('GMT', 'UTC');
    return /^UTC[+-]0$/.test(label) ? 'UTC' : label;
  } catch {
    return '';
  }
}

/**
 * Interpret a `<input type="datetime-local">` value ("YYYY-MM-DDTHH:mm") as
 * wall time in `timeZone` and return the UTC instant (ISO).
 */
export function zonedLocalToUtcISO(localValue: string, timeZone: string): string {
  const [datePart, timePart] = localValue.split('T');
  const [y, mo, d] = datePart.split('-').map(Number);
  const [h, mi] = timePart.split(':').map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const parts: Record<string, string> = {};
    for (const p of dtf.formatToParts(new Date(naive))) {
      if (p.type !== 'literal') parts[p.type] = p.value;
    }
    const asUTC = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    // Offset of the zone at the guess instant (wall − UTC).
    const offsetMs = asUTC - naive;
    return new Date(naive - offsetMs).toISOString();
  } catch {
    return new Date(naive).toISOString();
  }
}

/** Format an ISO instant in the given timezone (fr-FR medium date + short time). */
export function formatInTimezone(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }
}
