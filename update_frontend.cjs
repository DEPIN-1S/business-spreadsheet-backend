const fs = require('fs');

// 1. Update apiClient.js
const apiFile = '../spreadsheetfrontend/src/api/apiClient.js';
let apiContent = fs.readFileSync(apiFile, 'utf8');
const targetApi = `deleteTemplate: (templateId) => apiClient.delete(\`/templates/\${templateId}\`)`;
const replApi = `deleteTemplate: (templateId) => apiClient.delete(\`/templates/\${templateId}\`),\n    \n    // Saved Invoices\n    saveInvoice: (businessId, data) => apiClient.post(\`/business/\${businessId}/invoices\`, data),\n    getSavedInvoices: (businessId) => apiClient.get(\`/business/\${businessId}/invoices\`),\n    deleteSavedInvoice: (businessId, invoiceId) => apiClient.delete(\`/business/\${businessId}/invoices/\${invoiceId}\`),\n    clearSavedInvoices: (businessId) => apiClient.delete(\`/business/\${businessId}/invoices\`)`;

if (apiContent.includes(targetApi)) {
    apiContent = apiContent.replace(targetApi, replApi);
    fs.writeFileSync(apiFile, apiContent);
}

// 2. Update BusinessDetails.jsx
const bdFile = '../spreadsheetfrontend/src/Pages/BusinessDetails.jsx';
let bdContent = fs.readFileSync(bdFile, 'utf8');

// Replace state initialization and localstorage hook
const targetState = `    const [recentInvoices, setRecentInvoices] = useState(() => {
        try {
            const saved = localStorage.getItem('recentInvoices');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    });

    useEffect(() => {
        let invoicesToSave = [...(recentInvoices || [])];
        while (invoicesToSave.length > 0) {
            try {
                localStorage.setItem('recentInvoices', JSON.stringify(invoicesToSave));
                break;
            } catch (e) {
                // Check if it's a quota exceeded error
                if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                    // Remove the oldest invoice to free up space
                    invoicesToSave.pop();
                } else {
                    console.error('Error saving to localStorage:', e);
                    break;
                }
            }
        }
        
        // If it was completely emptied out (e.g. single item too large), ensure valid state
        if (invoicesToSave.length === 0 && recentInvoices?.length > 0) {
            try {
                localStorage.setItem('recentInvoices', JSON.stringify([]));
            } catch(e) {}
        }
    }, [recentInvoices]);`;

const replState = `    const [recentInvoices, setRecentInvoices] = useState([]);
    
    useEffect(() => {
        if (business?.id) {
            businessApi.getSavedInvoices(business.id)
                .then(res => {
                    if (res.data.success) {
                        setRecentInvoices(res.data.invoices);
                    }
                })
                .catch(err => console.error("Failed to load saved invoices", err));
        }
    }, [business?.id]);`;

const targetClear = `    const handleClearAllInvoices = () => {
        if (!window.confirm("Are you sure you want to clear all recent invoices? This will delete all locally saved invoice history and cannot be undone.")) return;
        setRecentInvoices([]);
        try { localStorage.removeItem('recentInvoices'); } catch(e) {}
        setInvoicePage(1);
    };`;

const replClear = `    const handleClearAllInvoices = async () => {
        if (!window.confirm("Are you sure you want to clear all recent invoices? This will delete all saved invoice history for this business and cannot be undone.")) return;
        try {
            await businessApi.clearSavedInvoices(business.id);
            setRecentInvoices([]);
            setInvoicePage(1);
        } catch (error) {
            console.error("Failed to clear invoices", error);
        }
    };`;

const targetDelete = `    const handleDeleteInvoice = (id) => {
        if (!window.confirm("Are you sure you want to delete this invoice?")) return;
        setRecentInvoices(prev => prev.filter(inv => inv.id !== id));
    };`;

const replDelete = `    const handleDeleteInvoice = async (id) => {
        if (!window.confirm("Are you sure you want to delete this invoice?")) return;
        try {
            await businessApi.deleteSavedInvoice(business.id, id);
            setRecentInvoices(prev => prev.filter(inv => inv.id !== id));
        } catch (error) {
            console.error("Failed to delete invoice", error);
        }
    };`;

if (bdContent.includes(targetState) && bdContent.includes(targetClear) && bdContent.includes(targetDelete)) {
    bdContent = bdContent.replace(targetState, replState);
    bdContent = bdContent.replace(targetClear, replClear);
    bdContent = bdContent.replace(targetDelete, replDelete);
    fs.writeFileSync(bdFile, bdContent);
} else {
    console.log("Failed to find targets in BusinessDetails.jsx");
    if (!bdContent.includes(targetState)) console.log("State target missing");
}

console.log("Success");
