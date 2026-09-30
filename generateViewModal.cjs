const fs = require('fs');
const path = require('path');

const generateInvoicePath = 'c:\\Users\\jithin pm\\work\\Freelancing\\spreadsheetfrontend\\src\\Components\\GenerateInvoiceModal.jsx';
const targetPath = 'c:\\Users\\jithin pm\\work\\Freelancing\\spreadsheetfrontend\\src\\Components\\ViewSavedInvoiceModal.jsx';

const content = fs.readFileSync(generateInvoicePath, 'utf8');

// We will extract the JSX return block and strip out editing components
const startIndex = content.indexOf('return ( <React.Fragment>');
if (startIndex === -1) {
    console.error("Could not find return block");
    process.exit(1);
}

// We will manually build the ViewSavedInvoiceModal
const newModal = `import React, { useRef } from 'react';
import { FiX, FiPrinter } from 'react-icons/fi';
import seal from '../assets/seal.png';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function ViewSavedInvoiceModal({ isOpen, onClose, savedInvoice }) {
    const printAreaRef = useRef(null);

    if (!isOpen || !savedInvoice || !savedInvoice.fullData) return null;

    const { items, totals, selectedSeals, template, business, party, date } = savedInvoice.fullData;
    const { invoiceNo, time } = savedInvoice;
    
    // Fallback template variables
    const templateName = template?.name || 'Standard Invoice';
    const cols = template?.formatData ? JSON.parse(template.formatData) : ['SL.', 'NAME', 'DATE', 'AMOUNT'];

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
            // Fallback to print if html2canvas/jspdf fails
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
                        <div 
                            id="business-invoice-print-area"
                            ref={printAreaRef}
                            className="bg-white mx-auto shadow-xl"
                            style={{ 
                                width: '210mm',
                                minHeight: '148.5mm',
                                border: '1px solid #000'
                            }}
                        >
                            <div className="flex justify-between items-stretch border-b-2 border-black" style={{ minHeight: '120px' }}>
                                <div className="flex-1 p-4 border-r border-black flex flex-col justify-center">
                                    <div className="flex items-center gap-4">
                                        {business?.logoUrl && (
                                            <div className="w-16 h-16 shrink-0 flex items-center justify-center border border-gray-200 rounded-full bg-gray-50 overflow-hidden">
                                                <img src={business.logoUrl} alt="Business Logo" className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                        <div>
                                            <h1 className="text-xl font-black uppercase text-gray-900 tracking-wider m-0">{business?.name || 'BUSINESS NAME'}</h1>
                                            {business?.address && <p className="text-sm text-gray-600 mt-1 max-w-xs">{business.address}</p>}
                                        </div>
                                    </div>
                                </div>
                                <div className="w-64 p-4 border-r border-black flex flex-col justify-center text-center bg-gray-50/50">
                                    <h2 className="text-lg font-black uppercase tracking-widest border-b border-black pb-2 mb-2 inline-block">TAX INVOICE</h2>
                                    <div className="text-sm text-gray-700 font-semibold space-y-1 text-left">
                                        <div className="flex justify-between"><span>Tax Inv. No. :</span><span>{invoiceNo}</span></div>
                                        <div className="flex justify-between"><span>Inv. Date :</span><span>{date}</span></div>
                                        <div className="flex justify-between"><span>Inv. Time :</span><span>{time}</span></div>
                                    </div>
                                </div>
                                <div className="w-64 p-4 flex flex-col justify-center">
                                    <h3 className="font-bold text-gray-900 uppercase text-sm mb-1">{party?.name || 'CASH CUSTOMER'}</h3>
                                    {party?.contact && <div className="text-xs text-gray-600">Phone : {party.contact}</div>}
                                    {party?.age || party?.gender ? (
                                        <div className="text-xs text-gray-600">
                                            {party.age ? \`Age : \${party.age}\` : ''} 
                                            {party.age && party.gender ? ' | ' : ''} 
                                            {party.gender ? \`Gender : \${party.gender}\` : ''}
                                        </div>
                                    ) : null}
                                </div>
                            </div>

                            <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed' }}>
                                <thead>
                                    <tr className="border-b-2 border-black text-xs uppercase font-bold tracking-wider">
                                        {cols.map((col, idx) => {
                                            const w = (idx === 0) ? '60px' : (idx === cols.length - 1) ? '120px' : 'auto';
                                            const align = (idx === cols.length - 1) ? 'text-center' : (idx === 0 ? 'text-center' : 'text-left');
                                            return <th key={col} className={\`p-2 border-r border-black \${align}\`} style={{ width: w }}>{col}</th>
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.filter(item => Object.values(item).some(v => v && typeof v === 'string' && v.trim() !== '')).map((item, rowIdx) => {
                                        totalItems++;
                                        const qty = parseFloat(item['Qty']) || 0;
                                        totalQty += qty;
                                        return (
                                            <tr key={rowIdx} className="border-b border-gray-300 last:border-b-2 last:border-black text-sm">
                                                {cols.map((col, colIdx) => {
                                                    const align = (colIdx === cols.length - 1) ? 'text-center' : (colIdx === 0 ? 'text-center' : 'text-left');
                                                    return (
                                                        <td key={col} className={\`p-1.5 border-r border-black font-medium text-gray-800 \${align}\`}>
                                                            {item[col]}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            <div className="flex justify-between items-stretch border-b-2 border-black" style={{ minHeight: '100px' }}>
                                <div className="flex-1 border-r border-black p-4 relative">
                                    <div className="flex items-center gap-4 text-xs font-bold text-gray-700">
                                        <div>Total Items : {totalItems}</div>
                                        <div>Total Qty : {totalQty}</div>
                                    </div>
                                    
                                    <div className="absolute bottom-2 left-4 flex gap-4 pointer-events-none">
                                        {selectedSeals.map((_, idx) => (
                                            <div key={idx} className="w-16 h-16 opacity-80 mix-blend-multiply">
                                                <img src={seal} alt="Seal" className="max-w-full max-h-full object-contain" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="w-80 flex flex-col justify-between p-0 bg-gray-50/30">
                                    <div className="p-3 text-xs space-y-1 font-semibold text-gray-600 border-b border-black flex-1">
                                        <div className="flex justify-between"><span>Gross Amt</span><span>{totals?.grossAmt || '0.00'}</span></div>
                                        <div className="flex justify-between"><span>Dis Amt</span><span>{totals?.disAmt || '0.00'}</span></div>
                                        <div className="flex justify-between"><span>Addl Chg</span><span>{totals?.addlChg || '0.00'}</span></div>
                                        <div className="flex justify-between"><span>GST Amt</span><span>{totals?.totalGst || '0.00'}</span></div>
                                        <div className="flex justify-between"><span>R.off</span><span>{totals?.rOff || '0.00'}</span></div>
                                    </div>
                                    <div className="p-3 bg-gray-100/50">
                                        <div className="flex justify-between items-center text-lg font-black tracking-wide">
                                            <span>Grand Total</span>
                                            <span>{computedGrandTotal}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="p-4 flex justify-end items-end h-32 relative">
                                <div className="text-center">
                                    <div className="text-xs font-bold text-gray-800 mb-16">For : {business?.name || 'BUSINESS NAME'}</div>
                                    <div className="text-xs font-bold border-t border-black pt-1 px-4 inline-block">Authorised Signatory</div>
                                </div>
                            </div>
                            
                        </div>
                    </div>
                </div>
            </div>
        </React.Fragment>
    );
}`;

fs.writeFileSync(targetPath, newModal);
console.log('Created ViewSavedInvoiceModal.jsx');
