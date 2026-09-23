import { Op } from 'sequelize';
import Business from "./business.model.js";
import BusinessParty from "./business_party.model.js";
import User from "../user/user.model.js";

// @desc    Create a new business
// @route   POST /api/business
// @access  Private
export const createBusiness = async (req, res, next) => {
    const { name, isProductBased, columns, logo, additionalData, sharedUsers, spreadsheetId, seals } = req.body;

    if (!name) {
        return res.status(400).json({ success: false, message: "Business name is required" });
    }

    try {
        const business = await Business.create({
            name,
            isProductBased: isProductBased !== undefined ? isProductBased : true,
            columns: columns || [],
            logo: logo || null,
            additionalData: additionalData || [],
            seals: seals || [],
            createdBy: req.user.id,
            spreadsheetId: spreadsheetId || null
        });

        if (sharedUsers && Array.isArray(sharedUsers)) {
            await business.setSharedUsers(sharedUsers);
        }

        res.status(201).json({ success: true, data: business });
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
        let businesses = await Business.findAll({
            where: {
                isDeleted: false
            },
            include: [{ 
                model: User, 
                as: 'sharedUsers', 
                attributes: ['id', 'name', 'role'],
                through: { attributes: [] } 
            }],
            order: [["createdAt", "DESC"]]
        });

        businesses = businesses.filter(b => 
            b.createdBy === req.user.id || 
            b.sharedUsers.some(u => u.id === req.user.id)
        );

        res.status(200).json({ success: true, data: businesses });
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
        const isShared = business.sharedUsers.some(u => u.id === req.user.id);

        if (!isOwner && !isShared) {
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
    const { name, isProductBased, columns, logo, additionalData, sharedUsers, spreadsheetId, seals } = req.body;

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

        const isOwner = business.createdBy === req.user.id;
        const isShared = business.sharedUsers.some(u => u.id === req.user.id);

        if (!isOwner && !isShared) {
            return res.status(403).json({ success: false, message: "Not authorized to update this business" });
        }

        if (name !== undefined) business.name = name;
        if (isProductBased !== undefined) business.isProductBased = isProductBased;
        if (columns !== undefined) business.columns = columns;
        if (logo !== undefined) business.logo = logo;
        if (additionalData !== undefined) business.additionalData = additionalData;
        if (seals !== undefined) business.seals = seals;
        if (spreadsheetId !== undefined) business.spreadsheetId = spreadsheetId;

        await business.save();

        if (sharedUsers !== undefined && Array.isArray(sharedUsers)) {
            // Only owners can modify shared users? Let's allow owners or editors. The plan assumes full access.
            await business.setSharedUsers(sharedUsers);
        }

        res.status(200).json({ success: true, data: business });
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

        const isOwner = business.createdBy === req.user.id;
        const isShared = business.sharedUsers.some(u => u.id === req.user.id);

        if (!isOwner && !isShared) {
            return res.status(403).json({ success: false, message: "Not authorized to delete this business" });
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
        const isShared = business.sharedUsers.some(u => u.id === req.user.id);
        if (!isOwner && !isShared) return res.status(403).json({ success: false, message: "Not authorized" });

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
        const isShared = business.sharedUsers.some(u => u.id === req.user.id);
        if (!isOwner && !isShared) return res.status(403).json({ success: false, message: "Not authorized" });

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
        const isShared = business.sharedUsers.some(u => u.id === req.user.id);
        if (!isOwner && !isShared) return res.status(403).json({ success: false, message: "Not authorized" });

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
