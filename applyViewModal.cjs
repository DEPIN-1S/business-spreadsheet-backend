const fs = require('fs');
let content = fs.readFileSync('c:\\Users\\jithin pm\\work\\Freelancing\\business-spreadsheet-backend\\temp_BusinessDetails.jsx', 'utf8');

// 1. Add Import
const importTarget = "import GenerateInvoiceModal from '../Components/GenerateInvoiceModal';";
const importAdd = "import GenerateInvoiceModal from '../Components/GenerateInvoiceModal';\nimport ViewSavedInvoiceModal from '../Components/ViewSavedInvoiceModal';";
content = content.replace(importTarget, importAdd);

// 2. Add State
const stateTarget = "const [recentInvoices, setRecentInvoices] = useState(() => {";
const stateAdd = `const [viewingSavedInvoice, setViewingSavedInvoice] = useState(null);\n    const [recentInvoices, setRecentInvoices] = useState(() => {`;
content = content.replace(stateTarget, stateAdd);

// 3. Update Buttons
const buttonTarget = `<button className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors inline-flex" title="View">
                                                    <FiEye size={16} />
                                                </button>
                                                <button className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors inline-flex" title="Download">
                                                    <FiDownload size={16} />
                                                </button>`;
const buttonAdd = `<button onClick={() => setViewingSavedInvoice(inv)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors inline-flex" title="View">
                                                    <FiEye size={16} />
                                                </button>
                                                <button onClick={() => setViewingSavedInvoice(inv)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors inline-flex" title="Download">
                                                    <FiDownload size={16} />
                                                </button>`;
content = content.replace(buttonTarget, buttonAdd);

// 4. Add Modal to the bottom
const endTarget = `        </div>
    );
}`;
const endAdd = `
            <ViewSavedInvoiceModal
                isOpen={!!viewingSavedInvoice}
                onClose={() => setViewingSavedInvoice(null)}
                savedInvoice={viewingSavedInvoice}
            />
        </div>
    );
}`;
content = content.replace(endTarget, endAdd);

fs.writeFileSync('c:\\Users\\jithin pm\\work\\Freelancing\\business-spreadsheet-backend\\temp_BusinessDetails.jsx', content);
console.log('Success');
