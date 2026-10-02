const fs = require('fs');
const file = '../spreadsheetfrontend/src/Components/GenerateInvoiceModal.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Fix TH width
const thTarget = `{cols.map(col => (
                                                visibleColumns[col] && <th key={col} className="border-r border-black py-1 px-1 text-center">{col.toUpperCase() === "DISCOUNT" ? "DISCOUNT %" : col.toUpperCase() === "GST" ? "GST %" : col}</th>
                                        ))}`;
const thRepl = `{cols.map(col => (
                                                visibleColumns[col] && <th key={col} className={\`border-r border-black py-1 px-1 text-center \${col === 'Product Name' ? 'w-[35%]' : ''}\`}>{col.toUpperCase() === "DISCOUNT" ? "DISCOUNT %" : col.toUpperCase() === "GST" ? "GST %" : col}</th>
                                        ))}`;

if (content.includes(thTarget)) {
    content = content.replace(thTarget, thRepl);
    console.log("Replaced TH target");
} else {
    console.log("TH target not found");
}

// 2. Fix Input to Textarea
const inputTarget = `<input 
                                                                    type="text" 
                                                                    value={item[col] || ''} 
                                                                    onChange={(e) => {
                                                                        handleItemChange(item.id, col, e.target.value);
                                                                        setActiveDropdownRow(item.id);
                                                                    }} 
                                                                    onFocus={() => { setActiveDropdownRow(item.id); if (!item['Product Name']) setInventoryData([]); }}
                                                                    onBlur={() => setTimeout(() => setActiveDropdownRow(null), 200)}
                                                                    className="w-full bg-transparent border-none outline-none text-center text-[10px] font-mono text-black m-0 p-0 h-full" 
                                                                    placeholder={col} 
                                                                />`;
const inputRepl = `<textarea 
                                                                    rows={2}
                                                                    value={item[col] || ''} 
                                                                    onChange={(e) => {
                                                                        handleItemChange(item.id, col, e.target.value);
                                                                        setActiveDropdownRow(item.id);
                                                                    }} 
                                                                    onFocus={() => { setActiveDropdownRow(item.id); if (!item['Product Name']) setInventoryData([]); }}
                                                                    onBlur={() => setTimeout(() => setActiveDropdownRow(null), 200)}
                                                                    className="w-full bg-transparent border-none outline-none text-center text-[10px] font-mono text-black m-0 p-0 h-full resize-none overflow-hidden block"
                                                                    style={{ minHeight: '30px', lineHeight: '1.2' }}
                                                                    placeholder={col} 
                                                                />`;

if (content.includes(inputTarget)) {
    content = content.replace(inputTarget, inputRepl);
    console.log("Replaced Input target for Product Name");
} else {
    console.log("Input target not found");
}

fs.writeFileSync(file, content);
console.log("Updated Product Name field to be multi-line and wider");
