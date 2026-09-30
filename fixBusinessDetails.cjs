const fs = require('fs');
let content = fs.readFileSync('c:\\Users\\jithin pm\\work\\Freelancing\\business-spreadsheet-backend\\temp_BusinessDetails.jsx', 'utf8');

// Fix the literal \n mistake
content = content.replace('<GenerateInvoiceModal\\n                onSaveInvoice={(invoice) => setRecentInvoices(prev => [invoice, ...prev])}', '<GenerateInvoiceModal\n                onSaveInvoice={(invoice) => setRecentInvoices(prev => [invoice, ...prev])}');

fs.writeFileSync('c:\\Users\\jithin pm\\work\\Freelancing\\business-spreadsheet-backend\\temp_BusinessDetails.jsx', content);
