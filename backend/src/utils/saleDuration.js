// Only use named duration fields; an absent/invalid duration is not a zero call.
function parseDuration(value) {
  const text = String(value ?? '').trim();
  if (!/^\d+(?:\.\d+)?$/.test(text)) return null;
  const seconds = Math.floor(Number(text));
  return Number.isSafeInteger(seconds) && seconds <= 2147483647 ? seconds : null;
}

function exportDuration(headers, columns) {
  for (const name of ['length_in_sec', 'call_duration', 'duration', 'length_in_seconds']) {
    const index = headers.indexOf(name);
    if (index >= 0) return parseDuration(columns[index]);
  }
  return null;
}

module.exports = { parseDuration, exportDuration };
