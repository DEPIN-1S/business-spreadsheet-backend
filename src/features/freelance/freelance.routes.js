import express from 'express';
import {
    getBusinesses, createBusiness, updateBusiness, deleteBusiness,
    getParties, createParty, updateParty, deleteParty,
    getInvoices, createInvoice, updateInvoice, deleteInvoice,
    getTemplates, createTemplate, updateTemplate, deleteTemplate
} from './freelance.controller.js';
import { protect } from '../../middleware/auth.js';

const router = express.Router();

router.use(protect());

// Businesses
router.route('/businesses').get(getBusinesses).post(createBusiness);
router.route('/businesses/:id').put(updateBusiness).delete(deleteBusiness);

// Parties
router.route('/parties').get(getParties).post(createParty);
router.route('/parties/:id').put(updateParty).delete(deleteParty);

// Invoices
router.route('/invoices').get(getInvoices).post(createInvoice);
router.route('/invoices/:id').put(updateInvoice).delete(deleteInvoice);

// Templates
router.route('/templates').get(getTemplates).post(createTemplate);
router.route('/templates/:id').put(updateTemplate).delete(deleteTemplate);

export default router;
