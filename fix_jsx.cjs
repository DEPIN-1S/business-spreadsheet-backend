const fs = require('fs');
const file = '../spreadsheetfrontend/src/Components/GenerateInvoiceModal.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = "className={`border-r border-black py-1 px-1 text-center ${col === \\'Product Name\\' ? \\'w-[35%]\\' : \\'\\'}`}";
const replStr = "className={`border-r border-black py-1 px-1 text-center ${col === 'Product Name' ? 'w-[35%]' : ''}`}";

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replStr);
    fs.writeFileSync(file, content);
    console.log("Fixed JSX syntax error");
} else {
    console.log("Target not found");
}
