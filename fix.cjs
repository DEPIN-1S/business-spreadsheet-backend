const fs = require('fs');
let content = fs.readFileSync('c:\\Users\\jithin pm\\work\\Freelancing\\spreadsheetfrontend\\src\\Components\\GenerateInvoiceModal.jsx', 'utf8');

const regex = /([ \t]*<\/div>\r?\n[ \t]*<\/div>\r?\n[ \t]*<\/div>\r?\n)[\s\S]*?(\{previewProduct && \()/;
const match = content.match(regex);
if (match) {
    const newContent = content.replace(regex, match[1] + '            ' + match[2]);
    fs.writeFileSync('c:\\Users\\jithin pm\\work\\Freelancing\\spreadsheetfrontend\\src\\Components\\GenerateInvoiceModal.jsx', newContent);
    console.log('Fixed');
} else {
    console.log('Not found');
}
