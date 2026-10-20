// Presets come from the specific dialer, never a shared hardcoded DID list.
function laRecording(recording, presets = {}) {
  const filename = String(recording.filename || recording.location || '')
    .split('?')[0].split('/').pop().replace(/\.(mp3|wav)$/i, '');
  const did = Object.keys(presets).find(number => filename.endsWith(number) &&
    (!presets[number].retiredOn || String(recording.date || '').slice(0, 10) <= presets[number].retiredOn));
  const seconds = String(recording.length ?? '').trim();
  if (!did || !/^\d+$/.test(seconds) || !/^\d{4}-\d{2}-\d{2}/.test(recording.date || '')) return null;
  return { ...recording, did, disposition: presets[did].name, call_duration_seconds: Number(seconds) };
}

function durationBucket(seconds) {
  if (seconds >= 1500) return '1500';
  if (seconds >= 1000) return '1000';
  if (seconds >= 800) return '800';
  return null;
}

module.exports = { laRecording, durationBucket };
