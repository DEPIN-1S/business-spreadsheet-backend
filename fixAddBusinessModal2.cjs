const fs = require('fs');
const file = 'c:\\Users\\jithin pm\\work\\Freelancing\\spreadsheetfrontend\\src\\Components\\AddBusinessModal.jsx';
let content = fs.readFileSync(file, 'utf8');

const target = 'setSeals(initialData.seals || []);';
const replacement = `if (!initialData?.seals) {
                setSeals([]);
            } else if (typeof initialData.seals === 'string') {
                try { setSeals(JSON.parse(initialData.seals)); } catch(e) { setSeals([]); }
            } else {
                setSeals(Array.isArray(initialData.seals) ? initialData.seals : []);
            }`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(file, content);
    console.log('Fixed AddBusinessModal');
} else {
    console.log('Target string not found');
}
