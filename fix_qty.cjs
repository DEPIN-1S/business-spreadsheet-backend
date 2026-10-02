const fs = require('fs');
const file = '../spreadsheetfrontend/src/Components/GenerateInvoiceModal.jsx';
let content = fs.readFileSync(file, 'utf8');

const target = `    const handleItemChange = (id, field, value) => {
        let updatedItem = { [field]: value };
        
        if (field === 'Product Name') {`;

const repl = `    const handleItemChange = (id, field, value) => {
        // Enforce numeric only for Qty
        if (field === 'Qty') {
            value = value ? value.toString().replace(/[^0-9]/g, '') : '';
        }
        
        let updatedItem = { [field]: value };
        
        if (field === 'Product Name') {`;

if (content.includes(target)) {
    content = content.replace(target, repl);
    fs.writeFileSync(file, content);
    console.log("Updated Qty logic in handleItemChange");
} else {
    console.log("Target not found");
}
