const decode = text => String(text || '').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
  .replace(/&#(?:39|039);/g, "'").replace(/&nbsp;/gi, ' ').trim();

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return decode(match?.[1] ?? match?.[2] ?? match?.[3] ?? '');
}

function campaignIds(html) {
  const ids = new Set();
  for (const tag of html.match(/<a\b[^>]*>/gi) || []) {
    const href = attribute(tag, 'href');
    if (!/[?&]ADD=31(?:&|$)/i.test(href)) continue;
    const id = href.match(/[?&]campaign_id=([^&#]+)/i)?.[1];
    if (id) ids.add(decodeURIComponent(id));
  }
  if (!ids.size) throw new Error('Campaign list could not be read');
  return [...ids].sort();
}

function parsePresets(html) {
  const expected = html.match(/(\d+)\s+PRESETS FOR THIS CAMPAIGN/i);
  if (!expected) throw new Error('Campaign presets page could not be read');
  const presets = {};
  let found = 0;
  for (const row of html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || []) {
    const fields = {};
    for (const input of row.match(/<input\b[^>]*>/gi) || []) {
      fields[attribute(input, 'name')] = attribute(input, 'value');
    }
    if (!fields.preset_name || fields.preset_number === undefined) continue;
    found++;
    // Internal extensions and DTMF strings are not LA destination DIDs.
    if (!/^\+?[\d ()-]+$/.test(fields.preset_number)) continue;
    let number = fields.preset_number.replace(/\D/g, '');
    if (number.length === 11 && number.startsWith('1')) number = number.slice(1);
    if (number.length !== 10) continue;
    presets[number] = fields.preset_name;
  }
  if (found !== Number(expected[1])) throw new Error('Incomplete campaign preset response');
  return presets;
}

function mergePresets(previous, current, today) {
  const merged = {};
  for (const [did, entry] of Object.entries(previous || {})) {
    merged[did] = current[did] ? { name: current[did], retiredOn: null }
      : { ...entry, retiredOn: entry.retiredOn || today };
  }
  for (const [did, name] of Object.entries(current)) merged[did] = { name, retiredOn: null };
  return merged;
}

module.exports = { campaignIds, parsePresets, mergePresets };
