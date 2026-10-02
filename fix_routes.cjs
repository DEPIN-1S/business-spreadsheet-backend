const fs = require('fs');
const file = './src/features/business/business.routes.js';
let content = fs.readFileSync(file, 'utf8');

const targetImport = `    deleteBusiness\n} from "./business.controller.js";`;
const replImport = `    deleteBusiness,\n    saveInvoice, getSavedInvoices, deleteSavedInvoice, clearSavedInvoices\n} from "./business.controller.js";`;

const targetRoutes = `// Saved Invoices
router.post("/:businessId/invoices", protect, businessController.saveInvoice);
router.get("/:businessId/invoices", protect, businessController.getSavedInvoices);
router.delete("/:businessId/invoices/:invoiceId", protect, businessController.deleteSavedInvoice);
router.delete("/:businessId/invoices", protect, businessController.clearSavedInvoices);`;

const replRoutes = `// Saved Invoices
router.post("/:businessId/invoices", saveInvoice);
router.get("/:businessId/invoices", getSavedInvoices);
router.delete("/:businessId/invoices/:invoiceId", deleteSavedInvoice);
router.delete("/:businessId/invoices", clearSavedInvoices);`;

if (content.includes(targetImport)) {
    content = content.replace(targetImport, replImport);
}

if (content.includes(targetRoutes)) {
    content = content.replace(targetRoutes, replRoutes);
}

fs.writeFileSync(file, content);
console.log("Success");
