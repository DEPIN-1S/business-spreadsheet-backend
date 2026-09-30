const fs = require('fs');
const viewFile = 'c:\\Users\\jithin pm\\work\\Freelancing\\spreadsheetfrontend\\src\\Components\\ViewSavedInvoiceModal.jsx';
let viewContent = fs.readFileSync(viewFile, 'utf8');

viewContent = viewContent.replace(/items\.map/g, '(items || []).map');
viewContent = viewContent.replace(/cols\.map/g, '(cols || []).map');
viewContent = viewContent.replace(/selectedSeals\.map/g, '(selectedSeals || []).map');

// To be safe, if we already replaced it, it might become `(items || []) || []).map`. Let's avoid that.
viewContent = viewContent.replace(/\(\(items \|\| \[\]\) \|\| \[\]\)\.map/g, '(items || []).map');
viewContent = viewContent.replace(/\(\(cols \|\| \[\]\) \|\| \[\]\)\.map/g, '(cols || []).map');
viewContent = viewContent.replace(/\(\(selectedSeals \|\| \[\]\) \|\| \[\]\)\.map/g, '(selectedSeals || []).map');

fs.writeFileSync(viewFile, viewContent);
console.log('Fixed mapping arrays');
