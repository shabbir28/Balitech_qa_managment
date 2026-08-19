const fs = require('fs');
const path = require('path');
const routesDir = path.join(__dirname, 'src', 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('Routes.js') && f !== 'authRoutes.js' && f !== 'userRoutes.js');

files.forEach(file => {
  const filePath = path.join(routesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace authorize('Manager', 'User') with authorize('Super Admin', 'QA Admin', 'QA Agent')
  content = content.replace(/authorize\('Manager',\s*'User'\)/g, "authorize('Super Admin', 'QA Admin', 'QA Agent')");
  
  // Replace authorize('Manager') with authorize('Super Admin', 'QA Admin')
  content = content.replace(/authorize\('Manager'\)/g, "authorize('Super Admin', 'QA Admin')");

  // Replace authorize('User') with authorize('QA Agent')
  content = content.replace(/authorize\('User'\)/g, "authorize('QA Agent')");

  fs.writeFileSync(filePath, content);
  console.log('Updated ' + file);
});
