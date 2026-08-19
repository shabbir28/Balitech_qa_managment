const fs = require('fs');

let file = fs.readFileSync('src/controllers/dialerSalesController.js', 'utf8');
file = file.replace(/\['D2', 'D3', 'D4', 'D5', 'DSB', 'D1', 'HIB'\]/g, "['D2', 'D3', 'D4', 'D5', 'DSB', 'D1', 'HIB', 'HIMAIN']");
fs.writeFileSync('src/controllers/dialerSalesController.js', file);

let backfill = fs.readFileSync('backfill_archived.js', 'utf8');
backfill = backfill.replace(/\['D2', 'D3', 'D4', 'D5', 'DSB', 'D1', 'HIB'\]/g, "['D2', 'D3', 'D4', 'D5', 'DSB', 'D1', 'HIB', 'HIMAIN']");
// Remove pharmacy from backfill
backfill = backfill.replace(/\{ type: 'pharmacy', statuses: \['Approved', 'S_Appr', 'A_Appr'\] \}/g, "");
fs.writeFileSync('backfill_archived.js', backfill);
