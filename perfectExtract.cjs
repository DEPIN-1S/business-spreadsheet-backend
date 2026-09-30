const fs = require('fs');

const genFile = 'c:\\Users\\jithin pm\\work\\Freelancing\\business-spreadsheet-backend\\temp_GenerateInvoiceModal.jsx';
const viewFile = 'c:\\Users\\jithin pm\\work\\Freelancing\\spreadsheetfrontend\\src\\Components\\ViewSavedInvoiceModal.jsx';

let genContent = fs.readFileSync(genFile, 'utf8');

const startStr = '<div \n                            id="business-invoice-print-area"';
let startIndex = genContent.indexOf(startStr);
if (startIndex === -1) {
    startIndex = genContent.indexOf('<div \r\n                            id="business-invoice-print-area"');
    if(startIndex === -1) {
        startIndex = genContent.indexOf('id="business-invoice-print-area"');
        startIndex = genContent.lastIndexOf('<div', startIndex);
    }
}

// Find the matching closing div for business-invoice-print-area
let divCount = 0;
let endIndex = -1;
let i = startIndex;

while (i < genContent.length) {
    if (genContent.substring(i, i + 4) === '<div') {
        divCount++;
        i += 4;
    } else if (genContent.substring(i, i + 5) === '</div') {
        divCount--;
        if (divCount === 0) {
            endIndex = i + 6; // include closing >
            break;
        }
        i += 5;
    } else {
        i++;
    }
}

let printArea = genContent.substring(startIndex, endIndex);

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
printArea = printArea.replace(/onFocus=\{.*?\}/g, '');
printArea = printArea.replace(/onBlur=\{.*?\}/g, '');

const newModal = `import React, { useRef } from 'react';
import { FiX, FiPrinter } from 'react-icons/fi';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function ViewSavedInvoiceModal({ isOpen, onClose, savedInvoice }) {
    const printAreaRef = useRef(null);

    if (!isOpen || !savedInvoice || !savedInvoice.fullData) return null;

    const { items, totals, selectedSeals, template, business, party, date } = savedInvoice.fullData;
    const { invoiceNo, time } = savedInvoice;
    
    // Fallback template variables
    const cols = template?.formatData ? JSON.parse(template.formatData) : ['SL.', 'NAME', 'DATE', 'AMOUNT'];
    const initialCols = cols.reduce((acc, c) => ({ ...acc, [c]: true }), { slNo: true });
    const visibleColumns = template?.visibleColumns ? (typeof template.visibleColumns === 'string' ? JSON.parse(template.visibleColumns) : template.visibleColumns) : initialCols;
    const templateName = template?.name || 'Standard Invoice';
    const formatDateDMY = (d) => d;

    // Calculations
    let totalItems = 0;
    let totalQty = 0;
    
    const computedGrandTotal = (
        (parseFloat(totals?.grossAmt) || 0) - 
        (parseFloat(totals?.disAmt) || 0) + 
        (parseFloat(totals?.addlChg) || 0) + 
        (parseFloat(totals?.totalGst) || 0) + 
        (parseFloat(totals?.rOff) || 0)
    ).toFixed(2);

    const handlePrint = () => {
        window.print();
    };

    const handleDownload = async () => {
        if (!printAreaRef.current) return;
        try {
            const canvas = await html2canvas(printAreaRef.current, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(\`\${invoiceNo}.pdf\`);
        } catch (e) {
            console.error('Error generating PDF', e);
            window.print();
        }
    };

    return (
        <React.Fragment>
            <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                <style>{\`
                    @media print {
                        body * {
                            visibility: hidden !important;
                        }
                        #business-invoice-print-area, #business-invoice-print-area * {
                            visibility: visible !important;
                        }
                        #business-invoice-print-area {
                            position: absolute !important;
                            left: 0 !important;
                            top: 0 !important;
                            width: 100% !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            box-shadow: none !important;
                            border: none !important;
                        }
                        .no-print {
                            display: none !important;
                        }
                    }
                \`}</style>

                <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full overflow-hidden flex flex-col max-h-[95vh]">
                    
                    <div className="px-6 py-4 bg-gray-900 text-white flex items-center justify-between no-print border-b border-gray-800">
                        <div className="flex items-center gap-3">
                            <span className="bg-indigo-600 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">Saved Invoice</span>
                            <h2 className="text-lg font-bold truncate max-w-sm">{templateName}</h2>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 mr-2">
                                <button
                                    onClick={handleDownload}
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow transition-colors"
                                >
                                    Download PDF
                                </button>
                                <button 
                                    onClick={handlePrint}
                                    className="flex items-center gap-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-200 px-4 py-2 rounded-lg transition-colors border border-gray-700"
                                >
                                    <FiPrinter />
                                    <span>Print</span>
                                </button>
                            </div>
                            <div className="w-px h-6 bg-gray-700"></div>
                            <button 
                                onClick={onClose}
                                className="text-gray-400 hover:text-white transition-colors p-1"
                            >
                                <FiX size={24} />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto bg-gray-100 p-8 relative">
                        ${printArea}
                    </div>
                </div>
            </div>
        </React.Fragment>
    );
}
`;

fs.writeFileSync(viewFile, newModal);
console.log('Success');
