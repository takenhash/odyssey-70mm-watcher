export function normalizeLabel(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents ("Pellicule" variants etc.)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * True only when the combined experience labels clearly indicate IMAX *and* 70mm.
 * Cineplex currently tags these sessions experienceTypes: ["IMAX", "70mm"];
 * plain ["70mm"] and plain ["IMAX"] screenings both exist at this theatre and
 * must NOT match, nor may UltraAVX / VIP / Regular.
 */
export function isImax70mm(labels: string[]): boolean {
  const joined = ` ${labels.map(normalizeLabel).join(" ")} `;
  const hasImax = joined.includes(" imax ");
  const has70mm = /\b70\s?mm\b/.test(joined);
  return hasImax && has70mm;
}

/** "2026-09-16T00:00:00" or "9/16/2026" -> "2026-09-16". Throws on anything else. */
export function apiDateToISO(d: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})T/.exec(d.trim());
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(d.trim());
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  throw new Error(`Unexpected Cineplex date format: "${d}"`);
}

/** "2026-09-17" -> "9/17/2026" (the format the showtimes endpoint expects). */
export function isoToApiDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}/${y}`;
}

/** "2026-09-17" -> "Thursday, September 17" */
export function friendlyDate(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(`${iso}T12:00:00Z`));
}

/** "2026-09-16T14:00:00" (theatre-local wall time) -> "2:00 PM" */
export function sessionTimeLabel(startDateTime: string): string {
  const m = /T(\d{2}):(\d{2})/.exec(startDateTime);
  if (!m) return startDateTime;
  let h = Number(m[1]);
  const suffix = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m[2]} ${suffix}`;
}
