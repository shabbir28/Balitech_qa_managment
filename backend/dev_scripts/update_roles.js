const fs = require('fs');
const path = require('path');
const dir = 'src/routes';
const files = fs.readdirSync(dir);

files.forEach(file => {
  if (!file.endsWith('.js')) return;
  const p = path.join(dir, file);
  let cnt = fs.readFileSync(p, 'utf8');
  
  cnt = cnt.replace(/authorize\([^)]+\)/g, (match) => {
    if (match.includes('Agent')) {
      if (match.includes('Admin')) {
        return "authorize('Manager', 'User')";
      }
      return "authorize('User')";
    }
    return "authorize('Manager')";
  });
  
  fs.writeFileSync(p, cnt);
});
console.log('Done');
