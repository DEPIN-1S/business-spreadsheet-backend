import Template from "./template.model.js";
import Business from "../business/business.model.js";
import Spreadsheet from "../spreadsheet/spreadsheet.model.js";
import AppError from "../../utils/appError.js";

function parseSpreadsheetIds(spreadsheetIds, spreadsheetId) {
    let resolved = [];
    if (Array.isArray(spreadsheetIds)) {
        resolved = spreadsheetIds.filter(Boolean);
    } else if (typeof spreadsheetIds === 'string') {
        try {
            const parsed = JSON.parse(spreadsheetIds);
            if (Array.isArray(parsed)) resolved = parsed.filter(Boolean);
        } catch (e) {
            if (spreadsheetIds.trim()) resolved = [spreadsheetIds.trim()];
        }
    } else if (spreadsheetId) {
        resolved = [spreadsheetId];
    }
    return resolved;
}

// Create a new template for a business
export const createTemplate = async (req, res, next) => {
    try {
        const { businessId, name, isProductBased, isB2B, columns, spreadsheetId, spreadsheetIds, signatureImage } = req.body;

        if (!businessId || !name) {
            throw new AppError("Business ID and Template Name are required", 400);
        }

        const business = await Business.findOne({ where: { id: businessId, isDeleted: false } });
        if (!business) {
            throw new AppError("Business not found", 404);
        }

        const resolvedIds = parseSpreadsheetIds(spreadsheetIds, spreadsheetId);
        const primaryId = resolvedIds.length > 0 ? resolvedIds[0] : (spreadsheetId || null);

        const template = await Template.create({
            businessId,
            name,
            isProductBased: isProductBased !== undefined ? isProductBased : true,
            isB2B: isB2B !== undefined ? isB2B : false,
            columns: columns || [],
            spreadsheetId: primaryId,
            spreadsheetIds: resolvedIds,
            signatureImage: signatureImage || null
        });

        res.status(201).json({
            success: true,
            data: template,
            message: "Template created successfully"
        });
    } catch (e) {
        next(e);
    }
};

// Get all templates for a business
export const getTemplates = async (req, res, next) => {
    try {
        const { businessId } = req.params;

        const templates = await Template.findAll({
            where: { businessId },
            order: [["createdAt", "DESC"]]
        });

        const templatesWithDocs = await Promise.all(templates.map(async (t) => {
            const templateObj = t.toJSON();
            
            // Normalize spreadsheetIds array
            let ids = [];
            if (Array.isArray(templateObj.spreadsheetIds)) {
                ids = templateObj.spreadsheetIds.filter(Boolean);
            } else if (typeof templateObj.spreadsheetIds === 'string') {
                try {
                    const parsed = JSON.parse(templateObj.spreadsheetIds);
                    if (Array.isArray(parsed)) ids = parsed.filter(Boolean);
                } catch (e) {
                    if (templateObj.spreadsheetIds.trim()) ids = [templateObj.spreadsheetIds.trim()];
                }
            }
            if (ids.length === 0 && templateObj.spreadsheetId) {
                ids = [templateObj.spreadsheetId];
            }
            templateObj.spreadsheetIds = ids;

            if (ids.length > 0) {
                const sheets = await Spreadsheet.findAll({
                    where: { id: ids, isDeleted: false },
                    attributes: ["id", "name"]
                });
                const nameMap = new Map(sheets.map(s => [s.id, s.name]));
                const docNames = ids.map(id => nameMap.get(id)).filter(Boolean);
                templateObj.sourceDocumentNames = docNames;
                templateObj.sourceDocumentName = docNames.join(', ');
            } else {
                templateObj.sourceDocumentNames = [];
                templateObj.sourceDocumentName = null;
            }
            return templateObj;
        }));

        res.json({
            success: true,
            data: templatesWithDocs,
            message: "Templates fetched successfully"
        });
    } catch (e) {
        next(e);
    }
};

// Update a template
export const updateTemplate = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, isProductBased, isB2B, columns, spreadsheetId, spreadsheetIds, signatureImage } = req.body;

        const template = await Template.findByPk(id);
        if (!template) {
            throw new AppError("Template not found", 404);
        }

        if (name) template.name = name;
        if (isProductBased !== undefined) template.isProductBased = isProductBased;
        if (isB2B !== undefined) template.isB2B = isB2B;
        if (columns) template.columns = columns;
        
        if (spreadsheetIds !== undefined) {
            const resolvedIds = parseSpreadsheetIds(spreadsheetIds, spreadsheetId);
            template.spreadsheetIds = resolvedIds;
            template.spreadsheetId = resolvedIds.length > 0 ? resolvedIds[0] : null;
        } else if (spreadsheetId !== undefined) {
            template.spreadsheetId = spreadsheetId;
            template.spreadsheetIds = spreadsheetId ? [spreadsheetId] : [];
        }

        if (signatureImage !== undefined) template.signatureImage = signatureImage;

        await template.save();

        res.json({
            success: true,
            data: template,
            message: "Template updated successfully"
        });
    } catch (e) {
        next(e);
    }
};

// Delete a template
export const deleteTemplate = async (req, res, next) => {
    try {
        const { id } = req.params;

        const template = await Template.findByPk(id);
        if (!template) {
            throw new AppError("Template not found", 404);
        }

        await template.destroy();

        res.json({
            success: true,
            message: "Template deleted successfully"
        });
    } catch (e) {
        next(e);
    }
};
