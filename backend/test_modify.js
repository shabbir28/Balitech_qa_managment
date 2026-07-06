const AUTH_HEADER = 'Basic ' + Buffer.from('CRM_API:test123dssddscc').toString('base64');
const DIALER_BASE = 'https://bt1.dialerhosting.com/BkLuyT';

async function fetchAdminPage(path, method = 'GET', body = null) {
  const baseUrl = DIALER_BASE.replace(/\/+$/, '');
  const url = path.startsWith('http') ? path : `${baseUrl}/${path}`;
  const options = {
    method,
    headers: { Authorization: AUTH_HEADER },
  };
  const res = await fetch(url, options);
  return await res.text();
}

fetchAdminPage('admin_modify_lead.php?lead_id=12591711').then(html => {
  const extractField = (name) => {
    const rx = new RegExp(`name=["']?${name}["']?\\s+[^>]*value=["']?([^"'>]*)["']?`, 'i');
    const m = html.match(rx);
    if (!m) {
      const rx2 = new RegExp(`name=["']?${name}["']?[^>]*value=["']?([^"'>]*)["']?`, 'i');
      const m2 = html.match(rx2);
      return m2 ? m2[1].trim() : '';
    }
    return m ? m[1].trim() : '';
  };
  console.log('Phone:', extractField('phone_number'));
  console.log('City:', extractField('city'));
  console.log('Status:', extractField('status')); // wait status is a hidden field or text?
  
  // Recordings
  const audioLinks = html.match(/<a href="([^"]+)">\s*(?:AUDIO|WAV|MP3|PLAY)\s*<\/a>/gi);
  console.log('Audio Links exact:', audioLinks);
  
  // What if it just says 'location' or something? Let's get all links containing .mp3 or .wav
  const allLinks = html.match(/href="([^"]+)"/gi);
  const recs = allLinks ? allLinks.filter(l => l.toLowerCase().includes('.mp3') || l.toLowerCase().includes('.wav')) : [];
  console.log('All media links:', recs);

  // If no direct link, what do the recording links look like?
  const recLinks2 = html.match(/<a href="([^"]+)">(.*?)<\/a>/gi);
  if(recLinks2) {
      recLinks2.forEach(l => {
          if (l.includes('http') || l.includes('RECORDINGS')) console.log('Potential rec link:', l);
      });
  }
});
