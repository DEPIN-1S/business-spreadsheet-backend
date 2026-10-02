const fs = require('fs');

const controllerFile = './src/features/business/business.controller.js';
let cContent = fs.readFileSync(controllerFile, 'utf8');

if (!cContent.includes('SavedInvoice')) {
    cContent = cContent.replace(
        'import { Business, Template, BusinessParty, BusinessUser, User } from "../../config/associations.js";',
        'import { Business, Template, BusinessParty, BusinessUser, User, SavedInvoice } from "../../config/associations.js";'
    );
}

const newEndpoints = `

// --- Saved Invoices ---
export const saveInvoice = async (req, res) => {
    try {
        const { businessId } = req.params;
        const payload = req.body;
        const invoice = await SavedInvoice.create({
            businessId,
            invoiceNo: payload.invoiceNo,
            templateName: payload.templateName,
            date: payload.date,
            time: payload.time,
            partyName: payload.partyName,
            total: payload.total,
            grandTotal: payload.grandTotal,
            fullData: payload.fullData,
            createdBy: req.user.id
        });
        res.status(201).json({ success: true, invoice });
    } catch (error) {
        console.error("Error saving invoice:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getSavedInvoices = async (req, res) => {
    try {
        const { businessId } = req.params;
        const invoices = await SavedInvoice.findAll({
            where: { businessId },
            order: [['createdAt', 'DESC']]
        });
        res.status(200).json({ success: true, invoices });
    } catch (error) {
        console.error("Error fetching saved invoices:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const deleteSavedInvoice = async (req, res) => {
    try {
        const { businessId, invoiceId } = req.params;
        await SavedInvoice.destroy({ where: { id: invoiceId, businessId } });
        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Error deleting saved invoice:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const clearSavedInvoices = async (req, res) => {
    try {
        const { businessId } = req.params;
        await SavedInvoice.destroy({ where: { businessId } });
        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Error clearing saved invoices:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
`;

if (!cContent.includes('export const saveInvoice')) {
    fs.writeFileSync(controllerFile, cContent + newEndpoints);
}

const routeFile = './src/features/business/business.routes.js';
let rContent = fs.readFileSync(routeFile, 'utf8');

const routeTarget = `export default router;`;
const newRoutes = `
// Saved Invoices
router.post("/:businessId/invoices", protect, businessController.saveInvoice);
router.get("/:businessId/invoices", protect, businessController.getSavedInvoices);
router.delete("/:businessId/invoices/:invoiceId", protect, businessController.deleteSavedInvoice);
router.delete("/:businessId/invoices", protect, businessController.clearSavedInvoices);

export default router;`;

if (!rContent.includes('/invoices') && rContent.includes(routeTarget)) {
    rContent = rContent.replace(routeTarget, newRoutes);
    fs.writeFileSync(routeFile, rContent);
}

console.log("Success");
