import { uploadApi } from '../services/api';

const AUDIO_EXT = /\.(mp3|wav)$/i;

export function recordingFilename(rec, index = 0) {
  const base = (rec?.filename || '').trim() || `recording_${index + 1}.mp3`;
  return AUDIO_EXT.test(base) ? base : `${base}.mp3`;
}

function triggerBlobDownload(blob, filename) {
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(blobUrl);
}

/**
 * Download a call recording as a file. Tries the backend proxy first (bypasses
 * CORS and forces an attachment), then a direct fetch, then a plain anchor.
 * Returns 'proxy' | 'direct' | 'anchor' describing which path succeeded.
 */
export async function downloadRecording(rec, index = 0) {
  if (!rec?.location) throw new Error('No recording URL found.');
  const filename = recordingFilename(rec, index);

  try {
    // uploadApi has a long timeout so large audio files don't get cut off.
    const response = await uploadApi.get('/dialer/download-recording', {
      params: { url: rec.location, filename },
      responseType: 'blob',
    });
    triggerBlobDownload(new Blob([response.data], { type: 'audio/mpeg' }), filename);
    return 'proxy';
  } catch {
    // fall through
  }

  try {
    const directRes = await fetch(rec.location);
    if (!directRes.ok) throw new Error('Direct fetch failed');
    triggerBlobDownload(await directRes.blob(), filename);
    return 'direct';
  } catch {
    // fall through
  }

  const link = document.createElement('a');
  link.href = rec.location;
  link.setAttribute('download', filename);
  link.setAttribute('target', '_blank');
  link.setAttribute('rel', 'noopener');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return 'anchor';
}
