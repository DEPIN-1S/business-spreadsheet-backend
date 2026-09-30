const fs = require('fs');
const file = 'c:\\Users\\jithin pm\\work\\Freelancing\\spreadsheetfrontend\\src\\Components\\ViewSavedInvoiceModal.jsx';
let content = fs.readFileSync(file, 'utf8');

// Remove import
content = content.replace("import seal from '../assets/seal.png';", "");

// Fix rendering logic
// From:
// {selectedSeals.map((_, idx) => (
//     <div key={idx} className="w-16 h-16 opacity-80 mix-blend-multiply">
//         <img src={seal} alt="Seal" className="max-w-full max-h-full object-contain" />
//     </div>
// ))}
// To:
// {selectedSeals.map((sealUrl, idx) => (
//     <div key={idx} className="w-16 h-16 opacity-80 mix-blend-multiply">
//         <img src={sealUrl} alt="Seal" className="max-w-full max-h-full object-contain" />
//     </div>
// ))}

content = content.replace("{selectedSeals.map((_, idx) => (", "{selectedSeals.map((sealUrl, idx) => (");
content = content.replace("<img src={seal} alt=\"Seal\"", "<img src={sealUrl} alt=\"Seal\"");

fs.writeFileSync(file, content);
console.log('Fixed ViewSavedInvoiceModal');
