import InventoryItem from "./inventory.model.js";
import AppError from "../../utils/AppError.js";
import { getPagination, getMeta } from "../../utils/pagination.js";
import { logAction } from "../../utils/auditLogger.js";
import { Op } from "sequelize";
import sequelize from "../../config/db.js";

export const createItem = async (req, res, next) => {
    try {
        const item = await InventoryItem.create(req.body);
        await logAction(req.user.id, "inventory", item.id, "create", null, req.body, req);
        res.status(201).json({ data: item, message: "Inventory item created" });
    } catch (e) { next(e); }
};

export const listItems = async (req, res, next) => {
    try {
        const { page, limit, offset } = getPagination(req);
        const where = { isDeleted: false };
        if (req.query.category) where.category = req.query.category;
        if (req.query.location) where.location = req.query.location;
        if (req.query.search) where.name = { [Op.like]: `%${req.query.search}%` };
        const { rows, count } = await InventoryItem.findAndCountAll({ where, limit, offset, order: [["createdAt", "DESC"]] });
        res.json({ data: rows, meta: getMeta(page, limit, count) });
    } catch (e) { next(e); }
};

export const getItem = async (req, res, next) => {
    try {
        const item = await InventoryItem.findOne({ where: { id: req.params.id, isDeleted: false } });
        if (!item) throw new AppError("Item not found", 404);
        res.json({ data: item });
    } catch (e) { next(e); }
};

export const updateItem = async (req, res, next) => {
    try {
        const item = await InventoryItem.findOne({ where: { id: req.params.id, isDeleted: false } });
        if (!item) throw new AppError("Item not found", 404);
        const old = item.toJSON();
        await item.update(req.body);
        await logAction(req.user.id, "inventory", item.id, "update", old, req.body, req);
        res.json({ data: item, message: "Item updated" });
    } catch (e) { next(e); }
};

export const deleteItem = async (req, res, next) => {
    try {
        const item = await InventoryItem.findOne({ where: { id: req.params.id, isDeleted: false } });
        if (!item) throw new AppError("Item not found", 404);
        await item.update({ isDeleted: true });
        await logAction(req.user.id, "inventory", item.id, "delete", null, null, req);
        res.json({ message: "Item deleted" });
    } catch (e) { next(e); }
};

export const lowStockAlerts = async (req, res, next) => {
    try {
        const items = await InventoryItem.findAll({
            where: {
                isDeleted: false,
                quantity: { [Op.lte]: sequelize.col("minStock") }
            }
        });
        res.json({ data: items, message: `${items.length} item(s) below minimum stock` });
    } catch (e) { next(e); }
};

export const summary = async (req, res, next) => {
    try {
        const where = { isDeleted: false };
        const items = await InventoryItem.findAll({ where, raw: true });
        const totalValue = items.reduce((acc, i) => acc + parseFloat(i.quantity) * parseFloat(i.costPerUnit), 0);
        const categories = [...new Set(items.map(i => i.category).filter(Boolean))];
        const totalItems = items.length;
        const totalUnits = items.reduce((acc, i) => acc + parseFloat(i.quantity), 0);
        res.json({ data: { totalItems, totalUnits: totalUnits.toFixed(4), totalValue: totalValue.toFixed(4), categories } });
    } catch (e) { next(e); }
};
