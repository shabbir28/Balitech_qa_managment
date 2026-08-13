const fs = require('fs');
const html = fs.readFileSync('campaign_001.html', 'utf8');
const links = html.match(/<a[^>]*href=["']\/[^"']*admin\.php\?ADD=\d+[^"']*["'][^>]*>.*?<\/a>/gi) || html.match(/<a[^>]*href=["']admin\.php\?ADD=\d+[^"']*["'][^>]*>.*?<\/a>/gi);
if (links) {
  const uniqueLinks = [...new Set(links)];
  uniqueLinks.forEach(link => {
    console.log(link.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '));
  });
}
