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
