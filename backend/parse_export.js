const fs = require('fs');
const csv = fs.readFileSync('test_export2.csv', 'utf8');
const lines = csv.split('\n');
const cols = lines[0].split('\t');
cols.forEach((val, i) => console.log(i + ': ' + val));
