/**
 * Copies text to the clipboard.
 *
 * `navigator.clipboard` only exists in a secure context, so it is unavailable
 * when the app is served over plain HTTP on an office IP. The hidden-textarea
 * fallback keeps copy working there.
 *
 * @returns {Promise<boolean>} whether the copy succeeded
 */
export const copyText = async (text) => {
  const value = String(text ?? '');
  if (!value) return false;

  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Permission denied or the document lost focus — try the fallback.
    }
  }

  try {
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
};
