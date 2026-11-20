// Date helpers. "Today" and "Overdue" depend on the user's time zone, so we set it here.
// Change this one line if the team is somewhere else.
export const TZ = "Asia/Kolkata";

// How far ahead of UTC the time zone is at a given moment (in milliseconds).
function offsetMs(at: Date): number {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric",
  }).formatToParts(at);
  const n = (t: string) => Number(p.find((x) => x.type === t)!.value);
  return Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second")) - at.getTime();
}

// The moment today started, in the team's time zone.
export function startOfToday(now = new Date()): Date {
  const local = new Date(now.getTime() + offsetMs(now));
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - offsetMs(now));
}

// "2026-11-21" + "09:00" in the team's time zone -> a real moment in time.
export function fromZoned(dateStr: string, timeStr = "09:00"): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  const t = /^(\d{2}):(\d{2})$/.exec(timeStr);
  if (!d || !t) return null;
  const guess = Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2]);
  return new Date(guess - offsetMs(new Date(guess)));
}

// A date as "2026-11-21" (for date inputs), n days from today.
export function dateInput(plusDays = 0, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(now.getTime() + plusDays * 86_400_000));
}
export const timeInput = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
export const dateInputFrom = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));

// "Today 9:00 am", "Tomorrow 9:00 am", "Fri 21 Nov, 9:00 am"
export function formatDue(iso: string, now = new Date()): string {
  const day = dateInputFrom(iso);
  const time = new Intl.DateTimeFormat("en-AU", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  if (day === dateInput(0, now)) return `Today ${time}`;
  if (day === dateInput(1, now)) return `Tomorrow ${time}`;
  const label = new Intl.DateTimeFormat("en-AU", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));
  return `${label}, ${time}`;
}

export function dayLabel(dateStr: string): string {
  const d = fromZoned(dateStr, "12:00");
  return d ? new Intl.DateTimeFormat("en-AU", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" }).format(d) : dateStr;
}
