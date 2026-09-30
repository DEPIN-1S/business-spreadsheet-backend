const fs = require('fs');
let content = fs.readFileSync('c:\\Users\\jithin pm\\work\\Freelancing\\business-spreadsheet-backend\\temp_GenerateInvoiceModal.jsx', 'utf8');

// 1. Add state variables
const stateTarget = "const searchTimeoutRef = useRef(null);";
const stateAdd = `const searchTimeoutRef = useRef(null);
    const [recentInvoices, setRecentInvoices] = useState([]);
    const [isSaving, setIsSaving] = useState(false);`;
content = content.replace(stateTarget, stateAdd);

// 2. Add handleSaveInvoice
const fnTarget = "const computedGrandTotal = (grossVal - disVal + addlVal + gstVal + roffVal).toFixed(2);";
const fnAdd = `const computedGrandTotal = (grossVal - disVal + addlVal + gstVal + roffVal).toFixed(2);

    const handleSaveInvoice = async () => {
        setIsSaving(true);
        setTimeout(() => {
            const newInvoice = {
                id: Date.now(),
                invoiceNo: 'INV-2026-001',
                date: invoiceDate,
                partyName: party?.name || 'CASH CUSTOMER',
                total: computedGrandTotal,
            };
            setRecentInvoices(prev => [newInvoice, ...prev]);
            setIsSaving(false);
        }, 500);
    };`;
content = content.replace(fnTarget, fnAdd);

// 3. Add Save Button
let buttonTarget = "                                                <div className=\"relative\" ref={settingsRef}>";
if (!content.includes(buttonTarget)) {
    console.error("Button target not found!");
}
const buttonAdd = `                                                <div className="flex items-center gap-3 mr-4">
                        <button
                            onClick={handleSaveInvoice}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-xs font-semibold rounded-lg shadow transition-colors"
                        >
                            {isSaving ? 'Saving...' : 'Save Invoice'}
                        </button>
                    </div>
${buttonTarget}`;
content = content.replace(buttonTarget, buttonAdd);

// 4. Add Recent Invoices Section
// We want to insert this exactly before `{/* 2. Items Table */}` inside the right box.
let sectionTarget = "                            </div>\n                        </div>\n\n                        {/* 2. Items Table */}";
if (!content.includes(sectionTarget)) {
    sectionTarget = "                            </div>\r\n                        </div>\r\n\r\n                        {/* 2. Items Table */}";
}
if (!content.includes(sectionTarget)) {
    console.error("Section target not found!");
}

const sectionAdd = `                                {recentInvoices.length > 0 && (
                                    <div className="mt-2 border-t border-gray-300 pt-2 no-print">
                                        <h4 className="text-[10px] font-bold uppercase text-gray-500 mb-1">Recent Saved Invoices</h4>
                                        <div className="flex flex-col gap-1 max-h-32 overflow-y-auto pr-1">
                                            {recentInvoices.map(inv => (
                                                <div key={inv.id} className="p-1.5 bg-gray-50 border border-gray-200 rounded shadow-sm hover:bg-gray-100 cursor-pointer">
                                                    <div className="flex justify-between items-center">
                                                        <span className="font-bold text-indigo-600 text-[10px] truncate max-w-[100px]">{inv.invoiceNo}</span>
                                                        <span className="text-[9px] text-gray-500">{formatDateDMY(inv.date)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-end mt-0.5">
                                                        <div className="text-[9px] font-semibold truncate flex-1">{inv.partyName}</div>
                                                        <div className="text-[10px] font-black ml-1 text-right">₹{inv.total}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
` + sectionTarget;
content = content.replace(sectionTarget, sectionAdd);

fs.writeFileSync('c:\\Users\\jithin pm\\work\\Freelancing\\business-spreadsheet-backend\\temp_GenerateInvoiceModal.jsx', content);
console.log("Changes applied locally.");
