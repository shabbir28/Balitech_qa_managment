const XLSX = require('xlsx');
const path = require('path');
const file = path.join(__dirname, 'uploads', 'upload-1782919927876-207976937.xlsx');
try {
  const workbook = XLSX.readFile(file);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  console.log('Row 0:', rows[0]);
  console.log('Row 1:', rows[1]);
} catch (e) { console.error(e); }
