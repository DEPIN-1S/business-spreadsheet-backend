import express from "express";
import { protect } from "../../middleware/auth.js";
import {
    listParties, createParty, updateParty, deleteParty,
    listInvoices, createInvoice, getInvoice, updateInvoice, deleteInvoice,
    listLedger, updateLedger
} from "./inv_billing.controller.js";

const partyRouter = express.Router();
partyRouter.use(protect(["superadmin"]));
partyRouter.get("/:type", listParties);              // GET  /api/inv/parties/retail  or  /wholesale
partyRouter.post("/:type", createParty);             // POST /api/inv/parties/retail
partyRouter.put("/:type/:id", updateParty);          // PUT  /api/inv/parties/retail/:id
partyRouter.delete("/:type/:id", deleteParty);       // DELETE /api/inv/parties/retail/:id

const invoiceRouter = express.Router();
invoiceRouter.use(protect(["superadmin"]));
invoiceRouter.get("/", listInvoices);                // GET  /api/inv/invoices?type=retail|wholesale
invoiceRouter.post("/", createInvoice);              // POST /api/inv/invoices
invoiceRouter.get("/:id", getInvoice);               // GET  /api/inv/invoices/:id
invoiceRouter.put("/:id", updateInvoice);            // PUT  /api/inv/invoices/:id
invoiceRouter.delete("/:id", deleteInvoice);         // DELETE /api/inv/invoices/:id

const ledgerRouter = express.Router();
ledgerRouter.use(protect(["superadmin"]));
ledgerRouter.get("/", listLedger);                   // GET  /api/inv/ledger
ledgerRouter.patch("/:id", updateLedger);            // PATCH /api/inv/ledger/:id

export { partyRouter, invoiceRouter, ledgerRouter };
