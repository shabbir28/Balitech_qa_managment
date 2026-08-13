const fs = require('fs');
const html = fs.readFileSync('test_add32.html', 'utf8');
const links = html.match(/<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi);
if(links) {
  links.forEach(l => {
    const m = l.match(/href=["']([^"']+)["']/i);
    const txt = l.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (m && txt) {
      console.log(txt + ' === ' + m[1]);
    }
  });
}
