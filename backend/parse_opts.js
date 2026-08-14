const fs = require('fs');
const html = fs.readFileSync('export_page.html', 'utf8');

// The select name is usually "status[]" or similar
let startIndex = html.indexOf('<select');
while (startIndex !== -1) {
  let endIndex = html.indexOf('</select>', startIndex);
  if (endIndex === -1) break;
  let selectHtml = html.substring(startIndex, endIndex + 9);
  
  if (selectHtml.includes('name="status[]"') || selectHtml.includes('name=status[]')) {
    const lines = selectHtml.split('\n');
    for (const line of lines) {
      if (line.includes('<option')) {
        console.log(line.trim());
      }
    }
    break;
  }
  startIndex = html.indexOf('<select', endIndex);
}
