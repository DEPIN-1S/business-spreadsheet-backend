const fs = require('fs');
let content = fs.readFileSync('c:\\Users\\jithin pm\\work\\Freelancing\\business-spreadsheet-backend\\temp_GenerateInvoiceModal.jsx', 'utf8');

// 1. Add onSaveInvoice to the component props
const propsTarget = "export default function GenerateInvoiceModal({ isOpen, onClose, business, template, party }) {";
const propsAdd = "export default function GenerateInvoiceModal({ isOpen, onClose, business, template, party, onSaveInvoice }) {";
content = content.replace(propsTarget, propsAdd);

// 2. Remove internal recentInvoices state
const stateTarget = `    const [recentInvoices, setRecentInvoices] = useState([]);`;
content = content.replace(stateTarget, "");

// 3. Call onSaveInvoice and remove the internal setRecentInvoices
const saveTarget = `            setRecentInvoices(prev => [newInvoice, ...prev]);`;
const saveAdd = `            if (onSaveInvoice) onSaveInvoice(newInvoice);`;
content = content.replace(saveTarget, saveAdd);

// 4. Remove the Recent Invoices section from the modal itself
// We need to carefully remove it. 
// It starts with `                                {recentInvoices.length > 0 && (`
// and ends with `                                )}\n`
const regex = /[ \t]*\{recentInvoices\.length > 0 && \([\s\S]*?\}\)[\r]?\n/;
content = content.replace(regex, "");

fs.writeFileSync('c:\\Users\\jithin pm\\work\\Freelancing\\business-spreadsheet-backend\\temp_GenerateInvoiceModal.jsx', content);
console.log("GenerateInvoiceModal changes applied.");
