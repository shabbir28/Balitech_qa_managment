const fs = require('fs');
const html = fs.readFileSync('export_medicare.html', 'utf8');
const inputs = html.match(/name=['"]?([^'" >\\]+)['"]?/g);
if(inputs) {
  const set = new Set();
  inputs.forEach(i => set.add(i.split('=')[1].replace(/['"]/g, '')));
  console.log([...set].filter(n => !n.includes('pwd')).join('\n'));
}
