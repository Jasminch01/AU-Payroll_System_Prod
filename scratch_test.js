const date = new Date("2026-04-23T13:34:50Z");
const formatter = new Intl.DateTimeFormat('en-AU', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: "Australia/Sydney",
});
const parts = formatter.formatToParts(date);
const year = parts.find(p => p.type === 'year')?.value;
const month = parts.find(p => p.type === 'month')?.value;
const day = parts.find(p => p.type === 'day')?.value;
console.log(`${year}-${month}-${day}`);
