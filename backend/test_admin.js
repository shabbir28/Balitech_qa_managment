const { fetchAdminPage } = require('./src/controllers/dialerController');
fetchAdminPage('admin.php?ADD=999998').then(html => {
  const links = html.match(/<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi);
  if(links) {
    links.forEach(l => {
      const m = l.match(/href=["']([^"']+)["']/i);
      const txt = l.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (m) console.log(txt + ' === ' + m[1]);
    });
  }
}).catch(console.error);
