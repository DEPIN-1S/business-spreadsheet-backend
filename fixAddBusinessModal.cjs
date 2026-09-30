const fs = require('fs');
const file = 'c:\\Users\\jithin pm\\work\\Freelancing\\spreadsheetfrontend\\src\\Components\\AddBusinessModal.jsx';
let content = fs.readFileSync(file, 'utf8');

const target = 'const [seals, setSeals] = useState(initialData?.seals || []);';
const replacement = `const [seals, setSeals] = useState(() => {
        if (!initialData?.seals) return [];
        if (typeof initialData.seals === 'string') {
            try { return JSON.parse(initialData.seals); } catch(e) { return []; }
        }
        return Array.isArray(initialData.seals) ? initialData.seals : [];
    });`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(file, content);
    console.log('Fixed AddBusinessModal');
} else {
    console.log('Target string not found');
}
