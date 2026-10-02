import express from "express";
import { protect } from "../../middleware/auth.js";
import {
    createBusiness, listBusinessParties, addBusinessParty, deleteBusinessParty,
    listBusinesses,
    getBusiness,
    updateBusiness,
    deleteBusiness,
    saveInvoice, getSavedInvoices, deleteSavedInvoice, clearSavedInvoices
} from "./business.controller.js";

const router = express.Router();

router.use(protect()); // Apply auth to all business routes

router.route("/")
    .post(protect(["superadmin"]), createBusiness)
    .get(listBusinesses);

router.route("/:id")
    .get(getBusiness)
    .put(protect(["superadmin"]), updateBusiness)
    .delete(protect(["superadmin"]), deleteBusiness);

router.get("/:id/parties", listBusinessParties);
router.post("/:id/parties", addBusinessParty);
router.delete("/:id/parties/:partyId", deleteBusinessParty);


// Saved Invoices
router.post("/:businessId/invoices", saveInvoice);
router.get("/:businessId/invoices", getSavedInvoices);
router.delete("/:businessId/invoices/:invoiceId", deleteSavedInvoice);
router.delete("/:businessId/invoices", clearSavedInvoices);

export default router;

