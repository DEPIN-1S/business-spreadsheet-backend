import { Op } from 'sequelize';
import Business from "./business.model.js";
import SavedInvoice from "./saved_invoice.model.js";
import BusinessParty from "./business_party.model.js";
import BusinessUser from "./business_user.model.js";
import User from "../user/user.model.js";

// @desc    Create a new business
// @route   POST /api/business
// @access  Private
export const createBusiness = async (req, res, next) => {
    if (req.user?.role !== "superadmin") {
        return res.status(403).json({ success: false, message: "Forbidden – only Super Admin can create businesses" });
    }

    const { name, isProductBased, columns, logo, additionalData, sharedUsers, spreadsheetId, seals, signatures, signatureImage } = req.body;

    if (!name) {
        return res.status(400).json({ success: false, message: "Business name is required" });
    }

    try {
        const resolvedSignatures = Array.isArray(signatures) ? signatures : (signatureImage ? [signatureImage] : []);
        const resolvedPrimarySig = signatureImage || (resolvedSignatures.length > 0 ? resolvedSignatures[0] : null);

        const business = await Business.create({
            name,
            isProductBased: isProductBased !== undefined ? isProductBased : true,
            columns: columns || [],
            logo: logo || null,
            additionalData: additionalData || [],
            seals: seals || [],
            signatures: resolvedSignatures,
            signatureImage: resolvedPrimarySig,
            createdBy: req.user.id,
            spreadsheetId: spreadsheetId || null
        });

        if (sharedUsers && Array.isArray(sharedUsers)) {
            const userIds = sharedUsers
                .map(u => (typeof u === 'object' && u !== null ? u.id : u))
                .filter(Boolean)
                .filter(id => id !== req.user.id);
            await business.setSharedUsers(userIds);
        }

        const createdBusiness = await Business.findOne({
            where: { id: business.id },
            include: [{
                model: User,
                as: 'sharedUsers',
                attributes: ['id', 'name', 'role'],
                through: { attributes: [] }
            }]
        });

        res.status(201).json({ success: true, data: createdBusiness || business });
    } catch (error) {
        console.error("Error creating business:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// @desc    Get all businesses for the logged-in user
// @route   GET /api/business
// @access  Private
export const listBusinesses = async (req, res, next) => {
    try {
        const sharedBusinessRows = await BusinessUser.findAll({
            where: { userId: req.user.id },
            attributes: ['businessId']
        });
        const sharedBusinessIds = sharedBusinessRows.map(r => r.businessId);

        const businesses = await Business.findAll({
            where: {
                isDeleted: false,
                [Op.or]: [
                    { createdBy: req.user.id },
                    ...(sharedBusinessIds.length > 0 ? [{ id: { [Op.in]: sharedBusinessIds } }] : [])
                ]
            },
            include: [{ 
                model: User, 
                as: 'sharedUsers', 
                attributes: ['id', 'name', 'role'],
                through: { attributes: [] } 
            }],
            order: [["createdAt", "DESC"]]
        });

        // Deduplicate businesses by id to guarantee no duplicates are ever returned
        const seen = new Set();
        const uniqueBusinesses = [];
        for (const b of businesses) {
            if (!seen.has(b.id)) {
                seen.add(b.id);
                uniqueBusinesses.push(b);
            }
        }

        res.status(200).json({ success: true, data: uniqueBusinesses });
    } catch (error) {
        console.error("Error listing businesses:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// @desc    Get a specific business
// @route   GET /api/business/:id
// @access  Private
export const getBusiness = async (req, res, next) => {
    try {
        const business = await Business.findOne({
            where: {
                id: req.params.id,
                isDeleted: false
            },
            include: [{ 
                model: User, 
                as: 'sharedUsers', 
                attributes: ['id', 'name', 'role'],
                through: { attributes: [] } 
            }]
        });

        if (!business) {
            return res.status(404).json({ success: false, message: "Business not found" });
        }

        const isOwner = business.createdBy === req.user.id;
        const isShared = (business.sharedUsers || []).some(u => u.id === req.user.id);

        if (!isOwner && !isShared && req.user.role !== 'superadmin') {
            return res.status(403).json({ success: false, message: "Not authorized to access this business" });
        }

        res.status(200).json({ success: true, data: business });
    } catch (error) {
        console.error("Error getting business:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// @desc    Update a business
// @route   PUT /api/business/:id
// @access  Private
export const updateBusiness = async (req, res, next) => {
    const { name, isProductBased, columns, logo, additionalData, sharedUsers, spreadsheetId, seals, signatures, signatureImage } = req.body;

    try {
        let business = await Business.findOne({
            where: {
                id: req.params.id,
                isDeleted: false
            },
            include: [{ model: User, as: 'sharedUsers', attributes: ['id'] }]
        });

        if (!business) {
            return res.status(404).json({ success: false, message: "Business not found" });
        }

        if (req.user?.role !== 'superadmin') {
            return res.status(403).json({ success: false, message: "Forbidden – only Super Admin can edit businesses" });
        }

        if (name !== undefined) business.name = name;
        if (isProductBased !== undefined) business.isProductBased = isProductBased;
        if (columns !== undefined) business.columns = columns;
        if (logo !== undefined) business.logo = logo;
        if (additionalData !== undefined) business.additionalData = additionalData;
        if (seals !== undefined) business.seals = seals;
        if (signatures !== undefined) {
            business.signatures = Array.isArray(signatures) ? signatures : [];
            if (signatureImage === undefined) {
                business.signatureImage = business.signatures.length > 0 ? business.signatures[0] : null;
            }
        }
        if (signatureImage !== undefined) business.signatureImage = signatureImage;
        if (spreadsheetId !== undefined) business.spreadsheetId = spreadsheetId;

        await business.save();

        if (sharedUsers !== undefined && Array.isArray(sharedUsers)) {
            const userIds = sharedUsers
                .map(u => (typeof u === 'object' && u !== null ? u.id : u))
                .filter(Boolean)
                .filter(id => id !== business.createdBy);
            await business.setSharedUsers(userIds);
        }

        const updatedBusiness = await Business.findOne({
            where: { id: business.id },
            include: [{
                model: User,
                as: 'sharedUsers',
                attributes: ['id', 'name', 'role'],
                through: { attributes: [] }
            }]
        });

        res.status(200).json({ success: true, data: updatedBusiness || business });
    } catch (error) {
        console.error("Error updating business:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// @desc    Soft delete a business
// @route   DELETE /api/business/:id
// @access  Private
export const deleteBusiness = async (req, res, next) => {
    try {
        let business = await Business.findOne({
            where: {
                id: req.params.id,
                isDeleted: false
            },
            include: [{ model: User, as: 'sharedUsers', attributes: ['id'] }]
        });

        if (!business) {
            return res.status(404).json({ success: false, message: "Business not found" });
        }

        if (req.user?.role !== 'superadmin') {
            return res.status(403).json({ success: false, message: "Forbidden – only Super Admin can delete businesses" });
        }

        business.isDeleted = true;
        await business.save();

        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        console.error("Error deleting business:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const listBusinessParties = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';

        // Should also check if they have access to the business first
        const business = await Business.findOne({
            where: { id: req.params.id, isDeleted: false },
            include: [{ model: User, as: 'sharedUsers', attributes: ['id'] }]
        });
        
        if (!business) return res.status(404).json({ success: false, message: "Business not found" });
        const isOwner = business.createdBy === req.user.id;
        const isShared = (business.sharedUsers || []).some(u => u.id === req.user.id);
        if (!isOwner && !isShared && req.user.role !== 'superadmin') return res.status(403).json({ success: false, message: "Not authorized" });

        const whereClause = { businessId: req.params.id, isDeleted: false };
        if (search) {
            whereClause[Op.or] = [
                { name: { [Op.like]: `%${search}%` } },
                { contact: { [Op.like]: `%${search}%` } }
            ];
        }

        const { count, rows: parties } = await BusinessParty.findAndCountAll({
            where: whereClause,
            order: [['createdAt', 'DESC']],
            limit: limit,
            offset: offset
        });
        
        res.status(200).json({ 
            success: true, 
            parties, 
            pagination: {
                totalItems: count,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                limit
            }
        });
    } catch (error) {
        console.error('Error fetching parties:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const addBusinessParty = async (req, res) => {
    try {
        const { id: businessId } = req.params;
        const { id: partyIdParam, name, billingAddress, shippingAddress, contact, email, dlNo, gstin, pan, age, gender, additionalData } = req.body;
        
        const business = await Business.findOne({
            where: { id: businessId, isDeleted: false },
            include: [{ model: User, as: 'sharedUsers', attributes: ['id'] }]
        });
        if (!business) return res.status(404).json({ success: false, message: "Business not found" });
        const isOwner = business.createdBy === req.user.id;
        const isShared = (business.sharedUsers || []).some(u => u.id === req.user.id);
        if (!isOwner && !isShared && req.user.role !== 'superadmin') return res.status(403).json({ success: false, message: "Not authorized" });

        const currentYear = new Date().getFullYear();

        if (partyIdParam) {
            const existingParty = await BusinessParty.findOne({ where: { id: partyIdParam, businessId, isDeleted: false } });
            if (existingParty) {
                await existingParty.update({ 
                    name, 
                    billingAddress, 
                    shippingAddress, 
                    contact, 
                    email, 
                    dlNo, 
                    gstin, 
                    pan, 
                    age, 
                    gender, 
                    ageLastUpdatedYear: age ? currentYear : existingParty.ageLastUpdatedYear,
                    additionalData 
                });
                return res.status(200).json({ success: true, party: existingParty });
            }
        }

        const party = await BusinessParty.create({ 
            businessId, 
            name, 
            billingAddress, 
            shippingAddress, 
            contact, 
            email, 
            dlNo, 
            gstin, 
            pan, 
            age, 
            gender, 
            ageLastUpdatedYear: age ? currentYear : null,
            additionalData 
        });

        res.status(201).json({ success: true, party });
    } catch (error) {
        console.error("Error creating party:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const deleteBusinessParty = async (req, res) => {
    try {
        const { id, partyId } = req.params;
        
        const business = await Business.findOne({
            where: { id: id, isDeleted: false },
            include: [{ model: User, as: 'sharedUsers', attributes: ['id'] }]
        });
        if (!business) return res.status(404).json({ success: false, message: "Business not found" });
        const isOwner = business.createdBy === req.user.id;
        const isShared = (business.sharedUsers || []).some(u => u.id === req.user.id);
        if (!isOwner && !isShared && req.user.role !== 'superadmin') return res.status(403).json({ success: false, message: "Not authorized" });

        const { default: BusinessParty } = await import("./business_party.model.js");
        const party = await BusinessParty.findOne({ where: { id: partyId, businessId: id } });
        if (!party) return res.status(404).json({ success: false, message: "Party not found" });
        
        party.isDeleted = true;
        await party.save();
        
        res.status(200).json({ success: true, message: "Party deleted successfully" });
    } catch (error) {
        console.error("Error deleting party:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};


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
