const fs = require('fs');
const sys = fs.readFileSync('medicare_sys.html', 'utf8');
const camp = fs.readFileSync('medicare_camp.html', 'utf8');

const sSelects = sys.match(/name=["']?sale["']?[\s\S]*?<\/select>/gi);
const cSelects = camp.match(/name=["']?sale["']?[\s\S]*?<\/select>/gi);

console.log('Sys sale dropdowns:', sSelects ? sSelects.length : 0);
console.log('Camp sale dropdowns:', cSelects ? cSelects.length : 0);

if (sSelects) {
  const yes = sSelects.filter(s => /<option[^>]*value=['"]Y['"][^>]*selected/i.test(s) || s.includes("value='Y' selected") || s.includes('value="Y" selected') || s.includes('>Y<'));
  console.log('Sys Yes:', yes.length);
}
