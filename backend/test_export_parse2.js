const fs = require('fs');
const html = fs.readFileSync('export_medicare.html', 'utf8');
const inputs = html.match(/<input[^>]+name=['"]([^'"]+)['"][^>]*>/gi);
if(inputs) {
  inputs.forEach(i => {
    const m = i.match(/name=['"]([^'"]+)['"]/);
    if(m) console.log('input:', m[1]);
  });
}
const selects = html.match(/<select[^>]+name=['"]([^'"]+)['"][^>]*>/gi);
if(selects) {
  selects.forEach(i => {
    const m = i.match(/name=['"]([^'"]+)['"]/);
    if(m) console.log('select:', m[1]);
  });
}
