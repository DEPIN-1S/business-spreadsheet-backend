const fs = require('fs');
let content = fs.readFileSync('c:\\Users\\jithin pm\\work\\Freelancing\\business-spreadsheet-backend\\temp_BusinessDetails.jsx', 'utf8');

// Update useState to use localStorage
const stateTarget = "const [recentInvoices, setRecentInvoices] = useState([]);";
const stateAdd = `const [recentInvoices, setRecentInvoices] = useState(() => {
        try {
            const saved = localStorage.getItem('recentInvoices');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    });

    useEffect(() => {
        localStorage.setItem('recentInvoices', JSON.stringify(recentInvoices));
    }, [recentInvoices]);`;

content = content.replace(stateTarget, stateAdd);
fs.writeFileSync('c:\\Users\\jithin pm\\work\\Freelancing\\business-spreadsheet-backend\\temp_BusinessDetails.jsx', content);
console.log(content.includes('localStorage.setItem') ? 'Success' : 'Failed');
