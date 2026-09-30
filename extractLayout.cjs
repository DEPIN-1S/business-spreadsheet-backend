const fs = require('fs');

const genFile = 'c:\\Users\\jithin pm\\work\\Freelancing\\business-spreadsheet-backend\\temp_GenerateInvoiceModal.jsx';
const viewFile = 'c:\\Users\\jithin pm\\work\\Freelancing\\spreadsheetfrontend\\src\\Components\\ViewSavedInvoiceModal.jsx';

let genContent = fs.readFileSync(genFile, 'utf8');
let viewContent = fs.readFileSync(viewFile, 'utf8');

const startIndex = genContent.indexOf('<div id="business-invoice-print-area"');
if (startIndex === -1) throw new Error("Start not found");

// Find closing div. We know it ends before `</div>\n                </div>\n            </div>\n        </React.Fragment>`
const endIndex = genContent.indexOf('                        </div>\n                    </div>\n                </div>\n            </div>\n        </React.Fragment>');

if (endIndex === -1) throw new Error("End not found");

let printArea = genContent.substring(startIndex, endIndex + 30); // includes the closing div of print-area

// Now clean up the printArea
// 1. Remove date input
printArea = printArea.replace(/<span className="relative">\{formatDateDMY\(invoiceDate\)\}<input type="date".*?\/><\/span>/g, '{date}');
// Replace {formattedInvTime} with {time}
printArea = printArea.replace(/\{formattedInvTime\}/g, '{time}');
// Replace {isWholesale} with false (or just remove it since it's a view, but let's assume false or keep logic if we have party data, we can define isWholesale in View)
printArea = printArea.replace(/isWholesale/g, 'false');

// 2. Remove removeRow button
printArea = printArea.replace(/<button onClick=\{.*?\} className="absolute right-0 top-1\/2.*?FiTrash2.*?<\/button>/g, '');

// 3. Clean up the item mapping.
// It maps visibleColumns. We'll just define visibleColumns as a prop or local var in View
// The item name cell has an input.
const nameCellTargetRegex = /<input\s+type="text"\s+value=\{item\[col\] \|\| ''\}\s+onChange=\{.*?\}.*?\/>/gs;
printArea = printArea.replace(nameCellTargetRegex, '<div className="w-full text-center text-[10px] font-mono text-black m-0 p-0 h-full">{item[col] || ""}</div>');

// Remove the dropdown:
const dropdownRegex = /\{activeDropdownRow === item\.id && inventoryData\.length > 0 && \([\s\S]*?\}\)\}\s*<\/div>\s*\)\}/gs;
printArea = printArea.replace(dropdownRegex, '');

// Clean other inputs in footer (disAmt, addlChg)
const totalInputsRegex = /<div className="relative flex items-center group w-full">\s*<span.*?>.*?<\/span>\s*<input\s+type="number"\s+value=\{(.*?)\}.*?\/>\s*<\/div>/g;
printArea = printArea.replace(totalInputsRegex, '<div className="text-right text-gray-900 font-bold px-1">{$1}</div>');
const totalInputRegex2 = /<input\s+type="number"\s+value=\{(.*?)\}.*?\/>/g;
printArea = printArea.replace(totalInputRegex2, '<div className="text-right text-gray-900 font-bold">{$1}</div>');

// Replace {totals.disAmt} with {totals?.disAmt} etc. just in case
printArea = printArea.replace(/\{totals\.grossAmt\}/g, '{totals?.grossAmt || ""}');
printArea = printArea.replace(/\{totals\.disAmt\}/g, '{totals?.disAmt || ""}');
printArea = printArea.replace(/\{totals\.addlChg\}/g, '{totals?.addlChg || ""}');
printArea = printArea.replace(/\{totals\.rOff\}/g, '{totals?.rOff || ""}');
printArea = printArea.replace(/\{totals\.totalGst\}/g, '{totals?.totalGst || ""}');

// Fix seal remove button
printArea = printArea.replace(/<button onClick=\{.*?\} className="absolute -top-2 -right-2.*?FiX.*?<\/button>/g, '');

// Fix 'selectedSeals.map((seal, index)' -> 'selectedSeals.map((sealUrl, index)' and src
printArea = printArea.replace(/selectedSeals\.map\(\(seal, index\)/g, 'selectedSeals.map((sealUrl, index)');
printArea = printArea.replace(/src=\{seal\}/g, 'src={sealUrl}');

// Now replace the print area in viewFile
const vStartIndex = viewContent.indexOf('<div \n                            id="business-invoice-print-area"');
if (vStartIndex === -1) {
    const vStartIndex2 = viewContent.indexOf('<div \r\n                            id="business-invoice-print-area"');
    if (vStartIndex2 === -1) {
        const vStartIndex3 = viewContent.indexOf('<div id="business-invoice-print-area"');
        console.log("Start3:", vStartIndex3);
    }
}
// Regex replace the whole print area in View
const vPrintAreaRegex = /<div[\s\S]*?id="business-invoice-print-area"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/React\.Fragment>/;

if (viewContent.match(vPrintAreaRegex)) {
    // Wait, the printArea we grabbed ends with `<div id="business-invoice-print-area"...` and we want to replace up to the closing tags.
    // Let's just use string slicing.
    const vs = viewContent.indexOf('                    <div className="flex-1 overflow-y-auto bg-gray-100 p-8 relative">');
    const part1 = viewContent.substring(0, vs + '                    <div className="flex-1 overflow-y-auto bg-gray-100 p-8 relative">\n'.length);
    const part2 = `                        </div>\n                    </div>\n                </div>\n            </div>\n        </React.Fragment>\n    );\n}`;
    
    // We also need to add visibleColumns to ViewSavedInvoiceModal
    const visColInject = `
    const initialCols = cols.reduce((acc, c) => ({ ...acc, [c]: true }), { slNo: true });
    const visibleColumns = template?.visibleColumns ? (typeof template.visibleColumns === 'string' ? JSON.parse(template.visibleColumns) : template.visibleColumns) : initialCols;
    `;
    let newViewContent = part1 + printArea + part2;
    newViewContent = newViewContent.replace('const templateName = template?.name || \'Standard Invoice\';', visColInject + '\n    const templateName = template?.name || \'Standard Invoice\';');

    fs.writeFileSync(viewFile, newViewContent);
    console.log('Success');
} else {
    console.log('Regex match failed');
}
