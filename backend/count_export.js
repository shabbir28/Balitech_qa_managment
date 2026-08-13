const fs = require('fs');
const csv = fs.readFileSync('test_export_inbound.csv', 'utf8');
const lines = csv.split('\n');
console.log('Total Lines:', lines.length);
