const fs = require('fs');
const viewFile = 'c:\\Users\\jithin pm\\work\\Freelancing\\spreadsheetfrontend\\src\\Components\\ViewSavedInvoiceModal.jsx';
let viewContent = fs.readFileSync(viewFile, 'utf8');

// The block to remove starts with <div className={`no-print absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 opacity-100`}>
// and ends with </div> right before the closing </div> of the middle column.
// Since it contains `FiPlus`, we can regex replace the whole thing safely.

const targetRegex = /<div className=\{`no-print absolute top-1\/2.*?<\/div>\s*<\/div>\s*\)\}\(\)\}\s*<\/div>/s;

if (viewContent.match(targetRegex)) {
    viewContent = viewContent.replace(targetRegex, '');
    fs.writeFileSync(viewFile, viewContent);
    console.log('Removed Add Seal button');
} else {
    // If regex fails, let's just add the import for FiPlus so it doesn't crash!
    viewContent = viewContent.replace("import { FiX, FiPrinter }", "import { FiX, FiPrinter, FiPlus }");
    fs.writeFileSync(viewFile, viewContent);
    console.log('Imported FiPlus');
}
