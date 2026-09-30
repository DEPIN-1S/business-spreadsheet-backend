const fs = require('fs');

const genFile = 'c:\\Users\\jithin pm\\work\\Freelancing\\business-spreadsheet-backend\\temp_GenerateInvoiceModal.jsx';
const viewFile = 'c:\\Users\\jithin pm\\work\\Freelancing\\spreadsheetfrontend\\src\\Components\\ViewSavedInvoiceModal.jsx';

let genContent = fs.readFileSync(genFile, 'utf8');
let viewContent = fs.readFileSync(viewFile, 'utf8');

const startIndex = genContent.indexOf('<div \n                            id="business-invoice-print-area"');
let actualStartIndex = startIndex;
if (startIndex === -1) {
    actualStartIndex = genContent.indexOf('<div \r\n                            id="business-invoice-print-area"');
    if (actualStartIndex === -1) {
        actualStartIndex = genContent.indexOf('id="business-invoice-print-area"');
        actualStartIndex = genContent.lastIndexOf('<div', actualStartIndex);
    }
}

// Find the correct closing div block. The modal returns <React.Fragment> at the very end.
const endIndex = genContent.lastIndexOf('</React.Fragment>');
if (endIndex === -1) throw new Error("End not found");

// We only want up to the closing divs before </React.Fragment>
let printArea = genContent.substring(actualStartIndex, endIndex);
// Strip out the last 3 closing divs that close the modal backdrop
printArea = printArea.replace(/<\/div>\s*<\/div>\s*<\/div>\s*$/s, '');

// Clean it up
printArea = printArea.replace(/<span className="relative">\{formatDateDMY\(invoiceDate\)\}<input type="date".*?\/><\/span>/g, '{date}');
printArea = printArea.replace(/\{formattedInvTime\}/g, '{time}');
printArea = printArea.replace(/isWholesale/g, 'false');
printArea = printArea.replace(/<button onClick=\{.*?\} className="absolute right-0 top-1\/2.*?FiTrash2.*?<\/button>/g, '');
const nameCellTargetRegex = /<input\s+type="text"\s+value=\{item\[col\] \|\| ''\}\s+onChange=\{.*?\}.*?\/>/gs;
printArea = printArea.replace(nameCellTargetRegex, '<div className="w-full text-center text-[10px] font-mono text-black m-0 p-0 h-full">{item[col] || ""}</div>');
const dropdownRegex = /\{activeDropdownRow === item\.id && inventoryData\.length > 0 && \([\s\S]*?\}\)\}\s*<\/div>\s*\)\}/gs;
printArea = printArea.replace(dropdownRegex, '');
const totalInputsRegex = /<div className="relative flex items-center group w-full">\s*<span.*?>.*?<\/span>\s*<input\s+type="number"\s+value=\{(.*?)\}.*?\/>\s*<\/div>/g;
printArea = printArea.replace(totalInputsRegex, '<div className="text-right text-gray-900 font-bold px-1">{$1}</div>');
const totalInputRegex2 = /<input\s+type="number"\s+value=\{(.*?)\}.*?\/>/g;
printArea = printArea.replace(totalInputRegex2, '<div className="text-right text-gray-900 font-bold">{$1}</div>');
printArea = printArea.replace(/\{totals\.grossAmt\}/g, '{totals?.grossAmt || ""}');
printArea = printArea.replace(/\{totals\.disAmt\}/g, '{totals?.disAmt || ""}');
printArea = printArea.replace(/\{totals\.addlChg\}/g, '{totals?.addlChg || ""}');
printArea = printArea.replace(/\{totals\.rOff\}/g, '{totals?.rOff || ""}');
printArea = printArea.replace(/\{totals\.totalGst\}/g, '{totals?.totalGst || ""}');
printArea = printArea.replace(/<button onClick=\{.*?\} className="absolute -top-2 -right-2.*?FiX.*?<\/button>/g, '');
printArea = printArea.replace(/selectedSeals\.map\(\(seal, index\)/g, 'selectedSeals.map((sealUrl, index)');
printArea = printArea.replace(/src=\{seal\}/g, 'src={sealUrl}');
// Also remove `activeDropdownRow`, `handleItemChange`, etc.
printArea = printArea.replace(/onFocus=\{.*?\}/g, '');
printArea = printArea.replace(/onBlur=\{.*?\}/g, '');

// Now replace the print area in viewFile
const vs = viewContent.indexOf('                    <div className="flex-1 overflow-y-auto bg-gray-100 p-8 relative">');
const part1 = viewContent.substring(0, vs + '                    <div className="flex-1 overflow-y-auto bg-gray-100 p-8 relative">\n'.length);
const part2 = `                        </div>\n                    </div>\n                </div>\n            </div>\n        </React.Fragment>\n    );\n}`;

// Let's make sure we don't duplicate visColInject
let newViewContent = part1 + printArea + part2;
if (!newViewContent.includes('const initialCols')) {
    const visColInject = `
    const initialCols = cols.reduce((acc, c) => ({ ...acc, [c]: true }), { slNo: true });
    const visibleColumns = template?.visibleColumns ? (typeof template.visibleColumns === 'string' ? JSON.parse(template.visibleColumns) : template.visibleColumns) : initialCols;
    const formatDateDMY = (dateStr) => dateStr;
`;
    newViewContent = newViewContent.replace('const templateName = template?.name || \'Standard Invoice\';', visColInject + '\n    const templateName = template?.name || \'Standard Invoice\';');
}

fs.writeFileSync(viewFile, newViewContent);
console.log('Success');
