// Interpret native date / datetime-local inputs in the user's browser, never the server timezone.
// Return null for invalid dates and nonexistent local times (for example a DST clock change).
export function pastoralLocalDateToInstant(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value);
  if (!match) return null;
  const [, y, m, d, h = "00", min = "00"] = match;
  const [year, month, day, hour, minute] = [y, m, d, h, min].map(Number);
  if (year < 1000 || year > 9999) return null;
  const date = new Date(year, month - 1, day, hour, minute);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date.getHours() !== hour || date.getMinutes() !== minute) return null;
  return date.toISOString();
}
