const fs = require('fs');
const file = '../spreadsheetfrontend/src/Components/GenerateInvoiceModal.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = "style={{ minHeight: \\'30px\\', lineHeight: \\'1.2\\' }}";
const replStr = "style={{ minHeight: '30px', lineHeight: '1.2' }}";

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replStr);
    fs.writeFileSync(file, content);
    console.log("Fixed JSX syntax error");
} else {
    console.log("Target not found");
}
