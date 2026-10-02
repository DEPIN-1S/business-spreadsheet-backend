const fs = require('fs');
const file = '../spreadsheetfrontend/src/Components/GenerateInvoiceModal.jsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

// Find TH
let thIndex = lines.findIndex(l => l.includes('visibleColumns[col] && <th key={col} className="border-r border-black py-1 px-1 text-center">{col.toUpperCase() === "DISCOUNT"'));
if (thIndex !== -1) {
    lines[thIndex] = lines[thIndex].replace('className="border-r border-black py-1 px-1 text-center"', 'className={`border-r border-black py-1 px-1 text-center ${col === \\\'Product Name\\\' ? \\\'w-[35%]\\\' : \\\'\\\'}`}');
}

// Find Input
let inputStart = lines.findIndex((l, index) => l.includes('<input ') && lines[index+1] && lines[index+1].includes('type="text"'));
if (inputStart !== -1) {
    for (let i = inputStart; i < inputStart + 15; i++) {
        if (lines[i].includes('<input')) {
            lines[i] = lines[i].replace('<input', '<textarea');
        }
        if (lines[i].includes('type="text"')) {
            lines[i] = lines[i].replace('type="text"', 'rows={2}');
        }
        if (lines[i].includes('className=')) {
            lines[i] = lines[i].replace('className="w-full bg-transparent border-none outline-none text-center text-[10px] font-mono text-black m-0 p-0 h-full"', 'className="w-full bg-transparent border-none outline-none text-center text-[10px] font-mono text-black m-0 p-0 h-full resize-none overflow-hidden block" style={{ minHeight: \\\'30px\\\', lineHeight: \\\'1.2\\\' }}');
        }
    }
}

fs.writeFileSync(file, lines.join('\n'));
console.log("Updated Product Name field to be multi-line and wider");
