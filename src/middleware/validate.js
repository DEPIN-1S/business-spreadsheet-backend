import Joi from "joi";
import AppError from "../utils/AppError.js";

/**
 * Factory that returns a middleware validating req.body against the given Joi schema.
 */
export const validate = (schema) => (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
        const msg = error.details.map(d => d.message).join("; ");
        return next(new AppError(msg, 422));
    }
    req.body = value;
    next();
};

// ── Common schemas ──────────────────────────────────────────────────────────

export const schemas = {
    register: Joi.object({
        name: Joi.string().min(2).max(100).required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required(),
        phone: Joi.string().allow("", null),
        role: Joi.string().valid("staff", "admin", "superadmin").default("staff")
    }),

    login: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().required()
    }),

    createSheet: Joi.object({
        name: Joi.string().min(1).max(200).required(),
        description: Joi.string().allow("", null),
        folderId: Joi.string().uuid().allow(null),
        settings: Joi.object().default({}),
        isDetailedView: Joi.boolean().default(false),
        columns: Joi.array().items(Joi.object({
            name: Joi.string().required(),
            type: Joi.string().required(),
            width: Joi.number().integer().min(20).optional()
        })).optional()
    }),

    createColumn: Joi.object({
        name: Joi.string().min(1).max(100).required(),
        type: Joi.string().valid("text", "number", "date", "dropdown", "formula", "file", "currency", "fx", "image", "video", "multi_image", "comment", "pdf").default("text"),
        order: Joi.number().integer().min(0).default(0),
        orderIndex: Joi.number().integer().min(0),
        width: Joi.number().integer().min(20),
        options: Joi.array().default([]),
        validationRules: Joi.object().default({}),
        formulaExpr: Joi.string().allow(null, ""),
        currencyCode: Joi.string().valid("INR","USD","EUR","GBP","AED","SAR","CAD","AUD","SGD").allow(null, "")
    }),

    updateCell: Joi.object({
        rawValue: Joi.string().allow("", null).required()
    }),

    permission: Joi.object({
        userId: Joi.string().uuid().required(),
        canView: Joi.boolean().default(true),
        canEdit: Joi.boolean().default(false),
        canEditFormulas: Joi.boolean().default(false),
        restrictedColumns: Joi.array().items(Joi.string().uuid()).default([])
    }),

    shareSheet: Joi.object({
        email: Joi.string().email().required(),
        role: Joi.string().valid("viewer", "editor", "admin").default("viewer"),
        columnAccess: Joi.object().pattern(Joi.string(), Joi.string().valid('view', 'edit')).optional()
    }),

    updateShareRole: Joi.object({
        role: Joi.string().valid("viewer", "editor", "admin").required()
    }),

    createRoom: Joi.object({
        spreadsheetId: Joi.string().uuid().required(),
        name: Joi.string().min(1).max(100).required()
    }),

    inventoryItem: Joi.object({
        name: Joi.string().min(1).max(200).required(),
        sku: Joi.string().allow(null, ""),
        category: Joi.string().allow(null, ""),
        quantity: Joi.number().min(0).default(0),
        costPerUnit: Joi.number().min(0).default(0),
        location: Joi.string().allow(null, ""),
        minStock: Joi.number().min(0).default(0),
        unit: Joi.string().allow(null, ""),
        notes: Joi.string().allow(null, ""),
        spreadsheetId: Joi.string().uuid().allow(null)
    })
};

export default { validate, schemas };
