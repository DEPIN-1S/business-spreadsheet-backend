import InvGstOption from "./inv_gst.model.js";
import InvCategory from "./inv_category.model.js";
import InvDivision from "./inv_division.model.js";
import InvManufacturer from "./inv_manufacturer.model.js";
import InvCompany from "./inv_company.model.js";
import InvQuantityUnit from "./inv_quantity.model.js";
import InvHsnCode from "./inv_hsn.model.js";
import AppError from "../../utils/AppError.js";

const MASTER_MAP = {
    gst: { model: InvGstOption, valueField: "value" },
    categories: { model: InvCategory, valueField: "name" },
    divisions: { model: InvDivision, valueField: "name" },
    manufacturers: { model: InvManufacturer, valueField: "name" },
    companies: { model: InvCompany, valueField: "name" },
    "quantity-units": { model: InvQuantityUnit, valueField: "name" },
    "hsn-codes": { model: InvHsnCode, valueField: "name" }
};

// GET /api/inv/masters/:type → list all active options
export const listMasterOptions = async (req, res, next) => {
    try {
        const { type } = req.params;
        const entry = MASTER_MAP[type];
        if (!entry) throw new AppError(`Unknown master type: ${type}`, 400);
        const rows = await entry.model.findAll({ where: { isActive: true }, order: [[entry.valueField, "ASC"]] });
        res.json({ data: rows });
    } catch (e) { next(e); }
};

// POST /api/inv/masters/:type → add a new option
export const addMasterOption = async (req, res, next) => {
    try {
        const { type } = req.params;
        const entry = MASTER_MAP[type];
        if (!entry) throw new AppError(`Unknown master type: ${type}`, 400);
        const { value } = req.body;
        if (!value || !value.toString().trim()) throw new AppError("Value is required", 422);
        const created = await entry.model.create({ [entry.valueField]: value.toString().trim() });
        res.status(201).json({ data: created, message: "Option added" });
    } catch (e) {
        if (e.name === "SequelizeUniqueConstraintError") {
            return next(new AppError("This option already exists", 409));
        }
        next(e);
    }
};

// DELETE /api/inv/masters/:type/:id → deactivate (soft-delete) an option
export const deleteMasterOption = async (req, res, next) => {
    try {
        const { type, id } = req.params;
        const entry = MASTER_MAP[type];
        if (!entry) throw new AppError(`Unknown master type: ${type}`, 400);
        let item = await entry.model.findByPk(id);
        if (!item) {
            item = await entry.model.findOne({ where: { [entry.valueField]: id } });
        }
        if (!item) throw new AppError("Option not found", 404);
        await item.update({ isActive: false });
        res.json({ message: "Option removed" });
    } catch (e) { next(e); }
};
