// A busy shop scans this list, so an order card's meta line stays short:
// today's orders show a bare time, older ones gain a compact date. Formatting
// is done by hand rather than via toLocaleString so the output is stable
// across devices and locales.
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const SHORT_ID_LENGTH = 8;

/** `#4b141b63` — enough of the uuid to match a ticket without dominating the card. */
export function shortOrderId(id: string): string {
  return `#${id.slice(0, SHORT_ID_LENGTH)}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function clockTime(date: Date): string {
  const hours24 = date.getHours();
  const hours = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes} ${hours24 < 12 ? 'AM' : 'PM'}`;
}

/** `7:09 PM` for today's orders, `Aug 24, 6:36 PM` for anything older. */
export function formatOrderTime(iso: string, now: Date): string {
  const date = new Date(iso);
  const time = clockTime(date);
  if (isSameDay(date, now)) return time;
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${time}`;
}
