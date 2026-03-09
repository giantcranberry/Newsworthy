/**
 * Canonical timezone list used across the app.
 */
export const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'UTC', label: 'UTC' },
] as const

/** Short labels for display. */
export const TZ_LABELS: Record<string, string> = {
  'America/New_York': 'ET',
  'America/Chicago': 'CT',
  'America/Denver': 'MT',
  'America/Los_Angeles': 'PT',
  'America/Anchorage': 'AKT',
  'Pacific/Honolulu': 'HT',
  'UTC': 'UTC',
}

/**
 * Map non-canonical IANA timezone names to our canonical set.
 * e.g. America/Toronto → America/New_York (both are Eastern Time).
 */
const TZ_ALIASES: Record<string, string> = {
  // Eastern
  'America/Toronto': 'America/New_York',
  'America/Detroit': 'America/New_York',
  'America/Indiana/Indianapolis': 'America/New_York',
  'America/Kentucky/Louisville': 'America/New_York',
  'America/Iqaluit': 'America/New_York',
  'US/Eastern': 'America/New_York',
  'US/East-Indiana': 'America/New_York',
  'Canada/Eastern': 'America/New_York',
  // Central
  'America/Winnipeg': 'America/Chicago',
  'America/Rainy_River': 'America/Chicago',
  'America/Indiana/Knox': 'America/Chicago',
  'America/Menominee': 'America/Chicago',
  'US/Central': 'America/Chicago',
  'Canada/Central': 'America/Chicago',
  // Mountain
  'America/Edmonton': 'America/Denver',
  'America/Cambridge_Bay': 'America/Denver',
  'America/Boise': 'America/Denver',
  'US/Mountain': 'America/Denver',
  'Canada/Mountain': 'America/Denver',
  // Pacific
  'America/Vancouver': 'America/Los_Angeles',
  'America/Tijuana': 'America/Los_Angeles',
  'US/Pacific': 'America/Los_Angeles',
  'Canada/Pacific': 'America/Los_Angeles',
  // Alaska
  'US/Alaska': 'America/Anchorage',
  // Hawaii
  'US/Hawaii': 'Pacific/Honolulu',
  'Pacific/Johnston': 'Pacific/Honolulu',
}

/**
 * Normalize a timezone string to one of our canonical values.
 * Returns the canonical timezone, or falls back to America/New_York if unknown.
 */
export function normalizeTimezone(tz: string | null | undefined): string {
  if (!tz) return 'America/New_York'
  // Already canonical
  const canonical = TIMEZONES.find((t) => t.value === tz)
  if (canonical) return canonical.value
  // Check alias map
  if (TZ_ALIASES[tz]) return TZ_ALIASES[tz]
  // Unknown — default to Eastern
  return 'America/New_York'
}

/** Get short label for a timezone (normalizes first). */
export function tzLabel(tz: string | null | undefined): string {
  const normalized = normalizeTimezone(tz)
  return TZ_LABELS[normalized] || normalized
}
