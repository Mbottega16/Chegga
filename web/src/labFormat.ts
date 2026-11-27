// Chegga Web — small text helpers shared by the Studio Lab's newer views
// (Tactical motifs, Blunder DNA, Time trouble). Numbers go through Intl so
// they follow the reader's locale.

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const oneDecimal = new Intl.NumberFormat(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 0 });

/** 240 -> "2.4" (pawns). */
export function pawns(cp: number): string {
  return oneDecimal.format(cp / 100);
}

/** 0.27 -> "27%". */
export function pct(fraction: number): string {
  return percent.format(fraction);
}

/** 3.456 -> "3.5". */
export function decimal(n: number): string {
  return oneDecimal.format(n);
}

/** 1234 -> "1,234" (in the reader's locale). */
export function count(n: number): string {
  return whole.format(n);
}

/** "1 game" / "3 games". */
export function plural(n: number, one: string, many: string): string {
  return `${count(n)} ${n === 1 ? one : many}`;
}

/** Unix seconds -> a short local date, e.g. "Nov 3, 2026". */
export function shortDate(unixSeconds: number): string {
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(
    new Date(unixSeconds * 1000),
  );
}
