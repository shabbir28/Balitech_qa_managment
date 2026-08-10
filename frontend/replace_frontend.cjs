const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if(file.endsWith('.jsx') || file.endsWith('.js')) {
        results.push(file);
      }
    }
  });
  return results;
}

const srcDir = path.join(__dirname, 'src');
const files = walk(srcDir);

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // App.jsx and SidebarLayout.jsx and ProtectedRoute handling
  content = content.replace(/roles=\{\['Manager',\s*'User'\]\}/g, "roles={['Super Admin', 'QA Admin', 'QA Agent']}");
  content = content.replace(/roles=\{\['Manager'\]\}/g, "roles={['Super Admin', 'QA Admin']}");
  content = content.replace(/roles:\s*\['Manager',\s*'User'\]/g, "roles: ['Super Admin', 'QA Admin', 'QA Agent']");
  content = content.replace(/roles:\s*\['Manager'\]/g, "roles: ['Super Admin', 'QA Admin']");

  // hasRole('Manager') => hasRole('Super Admin', 'QA Admin')
  content = content.replace(/hasRole\('Manager'\)/g, "hasRole('Super Admin', 'QA Admin')");

  // user?.role === 'Manager' => ['Super Admin', 'QA Admin'].includes(user?.role)
  content = content.replace(/user\?\.role === 'Manager'/g, "['Super Admin', 'QA Admin'].includes(user?.role)");
  content = content.replace(/user\?\.role !== 'Manager'/g, "!['Super Admin', 'QA Admin'].includes(user?.role)");

  // Special cases in App.jsx or SidebarLayout.jsx where 'Manager' string is returned
  content = content.replace(/return 'Manager';/g, "return 'Super Admin';");

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log('Updated ' + file);
  }
});
