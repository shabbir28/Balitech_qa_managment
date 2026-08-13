const fs = require('fs');
const html = fs.readFileSync('search_form.html', 'utf8');
const inputs = html.match(/<input[^>]+name=['"]([^'"]+)['"][^>]*>/gi);
if(inputs) {
  inputs.forEach(i => {
    const m = i.match(/name=['"]([^'"]+)['"]/);
    if(m) console.log(m[1]);
  });
}
