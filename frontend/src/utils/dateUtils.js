import { format } from 'date-fns';

export const getEstDateString = (dateObj) => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(dateObj); // returns YYYY-MM-DD
};

export const fmtLocal = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const getEstFormattedDate = (dateObj = new Date()) => {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(dateObj);
};

export const getEstTimeOfDay = (dateObj = new Date()) => {
  const hourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    hour12: false
  }).format(dateObj);
  const hour = parseInt(hourStr, 10);
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
};

export const getEstDateTimeString = (dateInput) => {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(d);
};

/**
 * Splits a timestamp into EST date and time strings for two-line displays.
 * Returns null when the input is missing or unparseable.
 */
export const getEstDateTimeParts = (dateInput) => {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  return {
    date: new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', month: 'short', day: '2-digit', year: 'numeric',
    }).format(d),
    time: new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: true,
    }).format(d),
  };
};

/**
 * Formats a DATE column value (e.g. "2026-09-10" or "2026-09-10T00:00:00.000Z")
 * as a calendar day. `new Date('YYYY-MM-DD')` is parsed as UTC midnight, which
 * `format()` then renders in local time — a day early west of Greenwich — so
 * the Y/M/D digits are read directly instead.
 */
export const formatDateOnly = (value, fmt) => {
  if (!value) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  if (isNaN(d.getTime())) return '—';
  return format(d, fmt);
};

export const getPresets = () => {
  const now = new Date();
  const todayStr = getEstDateString(now); // EST today
  
  // Parse as local midnight to safely add/subtract days
  const baseDate = new Date(`${todayStr}T00:00:00`); 
  
  const today = fmtLocal(baseDate);

  const yesterdayDate = new Date(baseDate);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yd = fmtLocal(yesterdayDate);

  // Monday of current week (0=Sun → shift)
  const dow = baseDate.getDay();
  const mondayThis = new Date(baseDate);
  mondayThis.setDate(baseDate.getDate() - (dow === 0 ? 6 : dow - 1));
  const sundayThis = new Date(mondayThis);
  sundayThis.setDate(mondayThis.getDate() + 6);

  // Last week Mon–Sun
  const mondayLast = new Date(mondayThis);
  mondayLast.setDate(mondayThis.getDate() - 7);
  const sundayLast = new Date(mondayLast);
  sundayLast.setDate(mondayLast.getDate() + 6);

  // This month
  const monthStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const monthEnd   = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);

  // Last month
  const lastMonthStart = new Date(baseDate.getFullYear(), baseDate.getMonth() - 1, 1);
  const lastMonthEnd   = new Date(baseDate.getFullYear(), baseDate.getMonth(), 0);

  return [
    { label: 'Today',       start: today,                 end: today },
    { label: 'Yesterday',   start: yd,                    end: yd },
    { label: 'This Week',   start: fmtLocal(mondayThis),  end: fmtLocal(sundayThis) },
    { label: 'Last Week',   start: fmtLocal(mondayLast),  end: fmtLocal(sundayLast) },
    { label: 'This Month',  start: fmtLocal(monthStart),  end: fmtLocal(monthEnd) },
    { label: 'Last Month',  start: fmtLocal(lastMonthStart),end: fmtLocal(lastMonthEnd) },
    { label: 'Custom Range',start: null,                  end: null, isCustom: true },
  ];
};
