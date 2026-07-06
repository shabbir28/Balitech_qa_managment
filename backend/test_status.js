const fs=require('fs'); 
const html=fs.readFileSync('test_modify_lead.html','utf8'); 
const rx=/<select[^>]*name=["']?status["']?[^>]*>([\s\S]*?)<\/select>/gi; 
const m=rx.exec(html); 
if(m){ 
  const rx2=/<option[^>]*selected[^>]*value=["']?([^"'>]*)["']?/i; 
  const m2=m[1].match(rx2); 
  console.log('Status selected:', m2 ? m2[1] : 'null'); 
} else {
  // Is it a hidden field?
  const rx3 = /name=["']?status["']?[^>]*value=["']?([^"'>]*)["']?/i;
  const m3 = html.match(rx3);
  console.log('Status match fallback:', m3 ? m3[1] : 'null');
}
