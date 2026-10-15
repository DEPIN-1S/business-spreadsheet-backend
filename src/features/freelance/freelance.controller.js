import { Op } from 'sequelize';
import { FreelanceBusiness, FreelanceParty, FreelanceTemplate, FreelanceInvoice } from './freelance.model.js';

// --- Businesses ---
export const getBusinesses = async (req, res, next) => {
    try {
        const isSuperAdmin = req.user?.role === 'superadmin';
        const whereClause = isSuperAdmin ? {} : { userId: req.user.id };
        const businesses = await FreelanceBusiness.findAll({
            where: whereClause,
            include: [
                { model: FreelanceInvoice, as: 'invoices', attributes: ['id', 'grandTotal'] },
                { model: FreelanceParty, as: 'parties', attributes: ['id', 'name', 'type'] }
            ],
            order: [['createdAt', 'DESC']]
        });
        res.json({ success: true, data: businesses });
    } catch (e) {
        console.error('Error fetching freelance businesses:', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

export const createBusiness = async (req, res, next) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Business name is required' });
        }
        const business = await FreelanceBusiness.create({
            name: name.trim(),
            userId: req.user.id
        });
        res.json({ success: true, data: business });
    } catch (e) {
        console.error('Error creating freelance business:', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

export const updateBusiness = async (req, res, next) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Business name is required' });
        }
        const isSuperAdmin = req.user?.role === 'superadmin';
        const whereClause = isSuperAdmin ? { id: req.params.id } : { id: req.params.id, userId: req.user.id };
        const [updated] = await FreelanceBusiness.update({ name: name.trim() }, { where: whereClause });
        if (updated === 0) return res.status(404).json({ success: false, message: 'Business not found or unauthorized' });
        const business = await FreelanceBusiness.findByPk(req.params.id);
        res.json({ success: true, data: business });
    } catch (e) {
        console.error('Error updating freelance business:', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

export const deleteBusiness = async (req, res, next) => {
    try {
        const isSuperAdmin = req.user?.role === 'superadmin';
        const whereClause = isSuperAdmin ? { id: req.params.id } : { id: req.params.id, userId: req.user.id };
        await FreelanceInvoice.destroy({ where: { businessId: req.params.id } });
        await FreelanceParty.destroy({ where: { businessId: req.params.id } });
        const deleted = await FreelanceBusiness.destroy({ where: whereClause });
        if (deleted === 0) return res.status(404).json({ success: false, message: 'Business not found or unauthorized' });
        res.json({ success: true });
    } catch (e) {
        console.error('Error deleting freelance business:', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

// --- Parties ---
export const getParties = async (req, res, next) => {
    try {
        const whereClause = {};
        if (req.query.businessId) {
            whereClause.businessId = req.query.businessId;
        }
        const parties = await FreelanceParty.findAll({
            where: whereClause,
            order: [['createdAt', 'DESC']]
        });
        res.json({ success: true, data: parties });
    } catch (e) {
        console.error('Error fetching freelance parties:', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

export const createParty = async (req, res, next) => {
    try {
        const { businessId, name, type = 'party', customFields = [] } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Party name is required' });
        }
        if (!businessId) {
            return res.status(400).json({ success: false, message: 'Business ID is required' });
        }
        const party = await FreelanceParty.create({
            businessId,
            name: name.trim(),
            type,
            customFields,
            userId: req.user.id
        });
        res.json({ success: true, data: party });
    } catch (e) {
        console.error('Error creating freelance party:', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

export const updateParty = async (req, res, next) => {
    try {
        const { name, type, customFields } = req.body;
        const updateData = {};
        if (name !== undefined) updateData.name = name.trim();
        if (type !== undefined) updateData.type = type;
        if (customFields !== undefined) updateData.customFields = customFields;
        
        await FreelanceParty.update(updateData, { where: { id: req.params.id } });
        const updated = await FreelanceParty.findByPk(req.params.id);
        res.json({ success: true, data: updated });
    } catch (e) {
        console.error('Error updating freelance party:', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

export const deleteParty = async (req, res, next) => {
    try {
        await FreelanceParty.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (e) {
        console.error('Error deleting freelance party:', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

// --- Invoices ---
export const getInvoices = async (req, res, next) => {
    try {
        const isSuperAdmin = req.user?.role === 'superadmin';
        const whereClause = isSuperAdmin ? {} : { userId: req.user.id };
        if (req.query.businessId) {
            whereClause.businessId = req.query.businessId;
        }
        const invoices = await FreelanceInvoice.findAll({ where: whereClause, order: [['createdAt', 'DESC']] });
        res.json({ success: true, data: invoices });
    } catch (e) {
        console.error('Error fetching freelance invoices:', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

export const createInvoice = async (req, res, next) => {
    try {
        const invoiceData = { ...req.body, userId: req.user.id };
        if (invoiceData.id && String(invoiceData.id).length < 36) {
            delete invoiceData.id;
        }
        const invoice = await FreelanceInvoice.create(invoiceData);
        res.json({ success: true, data: invoice });
    } catch (e) {
        console.error('Error creating freelance invoice:', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

export const deleteInvoice = async (req, res, next) => {
    try {
        const isSuperAdmin = req.user?.role === 'superadmin';
        const whereClause = isSuperAdmin ? { id: req.params.id } : { id: req.params.id, userId: req.user.id };
        const deletedRows = await FreelanceInvoice.destroy({ where: whereClause });
        if (deletedRows === 0) {
            return res.status(404).json({ success: false, message: 'Invoice not found or unauthorized' });
        }
        res.json({ success: true });
    } catch (e) {
        console.error('Error deleting invoice:', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

export const updateInvoice = async (req, res, next) => {
    try {
        const invoiceData = { ...req.body };
        delete invoiceData.userId;
        const isSuperAdmin = req.user?.role === 'superadmin';
        const whereClause = isSuperAdmin ? { id: req.params.id } : { id: req.params.id, userId: req.user.id };
        const [updatedRows] = await FreelanceInvoice.update(invoiceData, { where: whereClause });
        if (updatedRows === 0) {
            return res.status(404).json({ success: false, message: 'Invoice not found or unauthorized' });
        }
        const updatedInvoice = await FreelanceInvoice.findByPk(req.params.id);
        res.json({ success: true, data: updatedInvoice || invoiceData });
    } catch (e) {
        console.error('Error updating freelance invoice:', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

// --- Templates ---
export const getTemplates = async (req, res, next) => {
    try {
        const isSuperAdmin = req.user?.role === 'superadmin';
        const whereClause = isSuperAdmin ? {} : { userId: req.user.id };
        const templates = await FreelanceTemplate.findAll({ where: whereClause, order: [['createdAt', 'DESC']] });
        res.json({ success: true, data: templates });
    } catch (e) {
        console.error('Error fetching freelance templates:', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

export const createTemplate = async (req, res, next) => {
    try {
        const template = await FreelanceTemplate.create({ ...req.body, userId: req.user.id });
        res.json({ success: true, data: template });
    } catch (e) {
        console.error('Error creating freelance template:', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

export const updateTemplate = async (req, res, next) => {
    try {
        const templateData = { ...req.body };
        delete templateData.userId;
        const isSuperAdmin = req.user?.role === 'superadmin';
        const whereClause = isSuperAdmin ? { id: req.params.id } : { id: req.params.id, userId: req.user.id };
        await FreelanceTemplate.update(templateData, { where: whereClause });
        res.json({ success: true });
    } catch (e) {
        console.error('Error updating freelance template:', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

export const deleteTemplate = async (req, res, next) => {
    try {
        const isSuperAdmin = req.user?.role === 'superadmin';
        const whereClause = isSuperAdmin ? { id: req.params.id } : { id: req.params.id, userId: req.user.id };
        await FreelanceTemplate.destroy({ where: whereClause });
        res.json({ success: true });
    } catch (e) {
        console.error('Error deleting freelance template:', e);
        res.status(500).json({ success: false, error: e.message });
    }
};
