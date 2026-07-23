import { Op } from "sequelize";
import sequelize from "../../config/db.js";
import InvFolder from "./inv_folder.model.js";
import InvSpreadsheet from "./inv_spreadsheet.model.js";
import InvRow from "./inv_row.model.js";
import InvCell from "./inv_cell.model.js";
import InvCcRow from "./inv_cc_row.model.js";
import InvCcCell from "./inv_cc_cell.model.js";
import InvCcMeta from "./inv_cc_meta.model.js";
import InvNotification from "../inv_notifications/inv_notification.model.js";
import { sendStockAlertEmail } from "../../utils/emailService.js";
import AppError from "../../utils/AppError.js";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS FOR STOCK SYNC & STATUS UPDATE
// ─────────────────────────────────────────────────────────────────────────────

async function syncParentInventory(parentRowId, transaction) {
    const allCcRows = await InvCcRow.findAll({
        where: { parentRowId, isDeleted: false },
        transaction
    });
    const ccRowIds = allCcRows.map(r => r.id);
    const allStockCells = await InvCcCell.findAll({
        where: {
            ccRowId: ccRowIds,
            columnId: "col-cc-quantity-stock"
        },
        transaction
    });
    let totalStock = 0;
    for (const cell of allStockCells) {
        totalStock += parseFloat(cell.rawValue || 0);
    }

    const mainInventoryCell = await InvCell.findOne({
        where: { rowId: parentRowId, columnId: "col-retail-inventory" },
        transaction
    });
    if (mainInventoryCell) {
        await mainInventoryCell.update({ rawValue: String(totalStock), computedValue: String(totalStock) }, { transaction });
    }
}

async function syncCcRowStatusAndNotification(ccRowId, transaction) {
    const stockCell = await InvCcCell.findOne({
        where: { ccRowId, columnId: "col-cc-quantity-stock" },
        transaction
    });
    if (!stockCell) return;
    const currentQty = parseFloat(stockCell.rawValue || 0);

    const notifiedCell = await InvCcCell.findOne({
        where: { ccRowId, columnId: "col-cc-quantity-notified" },
        transaction
    });
    const notifiedQty = parseFloat(notifiedCell?.rawValue || 0);

    const status =
        currentQty <= 0          ? "Out of Stock" :
        currentQty < notifiedQty ? "Low Stock"    :
                                   "Stock Available";

    await InvCcCell.upsert({
        ccRowId, columnId: "col-cc-status", rawValue: status
    }, { transaction });

    if (status === "Out of Stock" || status === "Low Stock") {
        const ccRow = await InvCcRow.findByPk(ccRowId, {
            include: [
                { model: InvCcCell, as: "cells" },
                {
                    model: InvRow,
                    include: [{ model: InvCell, as: "cells" }]
                }
            ],
            transaction
        });
        if (ccRow) {
            const cells = ccRow.cells || [];
            const parentRow = ccRow.InvRow;
            const parentCells = parentRow ? (parentRow.cells || []) : [];
            const getVal = (list, colId) => {
                const cell = list.find(c => c.columnId === colId);
                return cell ? cell.rawValue : "";
            };
            const productName = getVal(parentCells, "col-product-name") || "Unknown Product";
            const batchName = getVal(cells, "col-cc-batch") || "Unknown Batch";
            const type = status === "Out of Stock" ? "out_of_stock" : "low_stock";
            const title = status === "Out of Stock" ? `Out of Stock: ${productName}` : `Low Stock: ${productName}`;
            const message = status === "Out of Stock"
                ? `Batch "${batchName}" is completely out of stock.`
                : `Batch "${batchName}" has reached low stock level. Current quantity: ${currentQty} (Threshold: ${notifiedQty}).`;

            const existing = await InvNotification.findOne({
                where: { invCcRowId: ccRowId, type, isRead: false, isDismissed: false },
                transaction
            });
            if (!existing) {
                await InvNotification.create({
                    type,
                    title,
                    message,
                    invCcRowId: ccRowId,
                    invRowId: parentRow ? parentRow.id : null,
                    productName,
                    batchName,
                    currentQty
                }, { transaction });

                sendStockAlertEmail({
                    type,
                    title,
                    message,
                    productName,
                    batchName,
                    currentQty
                }).catch(err => console.error("[EmailService Error]", err));
            }
        }
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// FOLDERS
// ─────────────────────────────────────────────────────────────────────────────

export const listFolders = async (req, res, next) => {
    try {
        const where = { isDeleted: false };
        if (req.query.parentId !== undefined) {
            where.parentId = req.query.parentId === "null" ? null : req.query.parentId;
        }
        const folders = await InvFolder.findAll({ where, order: [["title", "ASC"]] });
        res.json({ data: folders });
    } catch (e) { next(e); }
};

export const createFolder = async (req, res, next) => {
    try {
        const { title, parentId } = req.body;
        if (!title?.trim()) throw new AppError("Folder title is required", 422);
        const folder = await InvFolder.create({
            title: title.trim(),
            parentId: parentId || null,
            createdBy: req.user?.id || null
        });
        res.status(201).json({ data: folder, message: "Folder created" });
    } catch (e) { next(e); }
};

export const updateFolder = async (req, res, next) => {
    try {
        const folder = await InvFolder.findOne({ where: { id: req.params.id, isDeleted: false } });
        if (!folder) throw new AppError("Folder not found", 404);
        const { title } = req.body;
        if (title) await folder.update({ title: title.trim() });
        res.json({ data: folder, message: "Folder updated" });
    } catch (e) { next(e); }
};

export const deleteFolder = async (req, res, next) => {
    try {
        const folder = await InvFolder.findOne({ where: { id: req.params.id, isDeleted: false } });
        if (!folder) throw new AppError("Folder not found", 404);
        await folder.update({ isDeleted: true });
        res.json({ message: "Folder deleted" });
    } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────────────────────
// SPREADSHEET FILES
// ─────────────────────────────────────────────────────────────────────────────

export const listSheets = async (req, res, next) => {
    try {
        const where = { isDeleted: false };
        if (req.query.folderId !== undefined) {
            where.folderId = req.query.folderId === "null" ? null : req.query.folderId;
        }
        const sheets = await InvSpreadsheet.findAll({ where, order: [["createdAt", "DESC"]] });
        res.json({ data: sheets });
    } catch (e) { next(e); }
};

export const createSheet = async (req, res, next) => {
    try {
        const { name, folderId } = req.body;
        if (!name?.trim()) throw new AppError("Sheet name is required", 422);
        // Auto-generate SKU: INV-SKU-{timestamp}
        const sku = `INV-SKU-${Date.now()}`;
        const sheet = await InvSpreadsheet.create({
            name: name.trim(),
            sku,
            folderId: folderId || null,
            createdBy: req.user?.id || null
        });
        // Pre-create 5 empty rows with cells for the new sheet
        const defaultColIds = [
            "col-product-image", "col-product-name", "col-retail-inventory",
            "col-composition", "col-company-name"
        ];
        for (let i = 0; i < 5; i++) {
            const row = await InvRow.create({ spreadsheetId: sheet.id, orderIndex: i });
            const cells = defaultColIds.map(columnId => ({
                rowId: row.id, columnId, rawValue: "", computedValue: ""
            }));
            await InvCell.bulkCreate(cells);
        }
        res.status(201).json({ data: sheet, message: "Inventory spreadsheet created" });
    } catch (e) { next(e); }
};

export const getSheet = async (req, res, next) => {
    try {
        const sheet = await InvSpreadsheet.findOne({
            where: { id: req.params.id, isDeleted: false },
            include: [{
                model: InvRow,
                as: "rows",
                where: { isDeleted: false },
                required: false,
                include: [
                    { model: InvCell, as: "cells" },
                    { model: InvCcMeta, as: "ccMeta", required: false }
                ]
            }],
            order: [
                [{ model: InvRow, as: "rows" }, "orderIndex", "ASC"]
            ]
        });
        if (sheet) {
            const rows = sheet.rows || [];
            for (const r of rows) {
                await syncParentInventory(r.id);
            }
            // Re-fetch sheet after sync
            const updatedSheet = await InvSpreadsheet.findOne({
                where: { id: req.params.id, isDeleted: false },
                include: [{
                    model: InvRow,
                    as: "rows",
                    where: { isDeleted: false },
                    required: false,
                    include: [
                        { model: InvCell, as: "cells" },
                        { model: InvCcMeta, as: "ccMeta", required: false }
                    ]
                }],
                order: [
                    [{ model: InvRow, as: "rows" }, "orderIndex", "ASC"]
                ]
            });
            return res.json({ data: updatedSheet || sheet });
        }
        res.json({ data: sheet });
    } catch (e) { next(e); }
};

export const updateSheet = async (req, res, next) => {
    try {
        const sheet = await InvSpreadsheet.findOne({ where: { id: req.params.id, isDeleted: false } });
        if (!sheet) throw new AppError("Sheet not found", 404);
        const { name, folderId, settings } = req.body;
        await sheet.update({
            ...(name ? { name: name.trim() } : {}),
            ...(folderId !== undefined ? { folderId: folderId || null } : {}),
            ...(settings ? { settings } : {})
        });
        res.json({ data: sheet, message: "Sheet updated" });
    } catch (e) { next(e); }
};

export const deleteSheet = async (req, res, next) => {
    try {
        const sheet = await InvSpreadsheet.findOne({ where: { id: req.params.id, isDeleted: false } });
        if (!sheet) throw new AppError("Sheet not found", 404);
        await sheet.update({ isDeleted: true });
        res.json({ message: "Sheet deleted" });
    } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────────────────────
// ROWS & CELLS (Main Spreadsheet)
// ─────────────────────────────────────────────────────────────────────────────

export const addRow = async (req, res, next) => {
    try {
        const sheet = await InvSpreadsheet.findOne({ where: { id: req.params.id, isDeleted: false } });
        if (!sheet) throw new AppError("Sheet not found", 404);
        const maxOrder = await InvRow.max("orderIndex", { where: { spreadsheetId: req.params.id } }) || 0;
        const row = await InvRow.create({ spreadsheetId: req.params.id, orderIndex: maxOrder + 1 });
        const defaultColIds = [
            "col-product-image", "col-product-name", "col-retail-inventory",
            "col-composition", "col-company-name"
        ];
        const cells = defaultColIds.map(columnId => ({
            rowId: row.id, columnId, rawValue: "", computedValue: ""
        }));
        await InvCell.bulkCreate(cells);
        const rowWithCells = await InvRow.findByPk(row.id, { include: [{ model: InvCell, as: "cells" }] });
        res.status(201).json({ data: rowWithCells, message: "Row added" });
    } catch (e) { next(e); }
};

export const deleteRow = async (req, res, next) => {
    try {
        const row = await InvRow.findOne({ where: { id: req.params.rowId, spreadsheetId: req.params.id, isDeleted: false } });
        if (!row) throw new AppError("Row not found", 404);
        await row.update({ isDeleted: true });
        res.json({ message: "Row deleted" });
    } catch (e) { next(e); }
};

// Bulk update cells for a row: body = { cells: [{ columnId, rawValue, computedValue }] }
export const updateCells = async (req, res, next) => {
    try {
        const { cells } = req.body;
        if (!Array.isArray(cells)) throw new AppError("cells must be an array", 422);
        for (const c of cells) {
            await InvCell.upsert({
                rowId: req.params.rowId,
                columnId: c.columnId,
                rawValue: c.rawValue ?? "",
                computedValue: c.computedValue ?? ""
            });
        }
        res.json({ message: "Cells updated" });
    } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────────────────────
// CC META (6 dropdown values per product row)
// ─────────────────────────────────────────────────────────────────────────────

export const getCcMeta = async (req, res, next) => {
    try {
        const row = await InvRow.findOne({ where: { id: req.params.rowId, isDeleted: false } });
        if (!row) throw new AppError("Row not found", 404);
        const meta = await InvCcMeta.findOne({ where: { rowId: req.params.rowId } });
        res.json({ data: meta || { rowId: req.params.rowId, gst: "", category: "", division: "", manufacturer: "", companyName: "", quantity: "", hsnCode: "" } });
    } catch (e) { next(e); }
};

export const updateCcMeta = async (req, res, next) => {
    try {
        const row = await InvRow.findOne({ where: { id: req.params.rowId, isDeleted: false } });
        if (!row) throw new AppError("Row not found", 404);
        const { gst, category, division, manufacturer, companyName, quantity, hsnCode } = req.body;
        const [meta] = await InvCcMeta.upsert({
            rowId: req.params.rowId,
            ...(gst !== undefined ? { gst } : {}),
            ...(category !== undefined ? { category } : {}),
            ...(division !== undefined ? { division } : {}),
            ...(manufacturer !== undefined ? { manufacturer } : {}),
            ...(companyName !== undefined ? { companyName } : {}),
            ...(quantity !== undefined ? { quantity } : {}),
            ...(hsnCode !== undefined ? { hsnCode } : {})
        });
        res.json({ data: meta, message: "Meta updated" });
    } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────────────────────
// CC ROWS & CELLS (Sub-Spreadsheet / Batch View)
// ─────────────────────────────────────────────────────────────────────────────

export const listCcRows = async (req, res, next) => {
    try {
        const ccRows = await InvCcRow.findAll({
            where: { parentRowId: req.params.rowId, isDeleted: false },
            include: [{ model: InvCcCell, as: "cells" }],
            order: [["orderIndex", "ASC"]]
        });
        res.json({ data: ccRows });
    } catch (e) { next(e); }
};

export const addCcRow = async (req, res, next) => {
    try {
        const row = await InvRow.findOne({ where: { id: req.params.rowId, isDeleted: false } });
        if (!row) throw new AppError("Parent row not found", 404);
        const maxOrder = await InvCcRow.max("orderIndex", { where: { parentRowId: req.params.rowId } }) || 0;
        const ccRow = await InvCcRow.create({ parentRowId: req.params.rowId, orderIndex: maxOrder + 1 });
        const defaultCcColIds = [
            "col-cc-batch", "col-cc-quantity-stock", "col-cc-expiry-date",
            "col-cc-purchase-rate", "col-cc-retail-profit", "col-cc-retail-selling-rate",
            "col-cc-discount", "col-cc-mrp", "col-cc-status", "col-cc-quantity-notified",
            "col-cc-wholesale-profit", "col-cc-wholesale-selling-rate", "col-cc-wholesale-margin"
        ];
        const cells = defaultCcColIds.map(columnId => ({
            ccRowId: ccRow.id, columnId, rawValue: "", computedValue: ""
        }));
        await InvCcCell.bulkCreate(cells);
        const ccRowWithCells = await InvCcRow.findByPk(ccRow.id, { include: [{ model: InvCcCell, as: "cells" }] });
        res.status(201).json({ data: ccRowWithCells, message: "Batch row added" });
    } catch (e) { next(e); }
};

export const deleteCcRow = async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
        const ccRow = await InvCcRow.findOne({ 
            where: { id: req.params.ccRowId, parentRowId: req.params.rowId, isDeleted: false },
            transaction: t
        });
        if (!ccRow) throw new AppError("Batch row not found", 404);
        await ccRow.update({ isDeleted: true }, { transaction: t });

        await syncParentInventory(req.params.rowId, t);

        await t.commit();
        res.json({ message: "Batch row deleted" });
    } catch (e) {
        await t.rollback();
        next(e);
    }
};

// Bulk update CC cells: body = { cells: [{ columnId, rawValue, computedValue }] }
export const updateCcCells = async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
        const { cells } = req.body;
        if (!Array.isArray(cells)) throw new AppError("cells must be an array", 422);

        for (const c of cells) {
            await InvCcCell.upsert({
                ccRowId: req.params.ccRowId,
                columnId: c.columnId,
                rawValue: c.rawValue ?? "",
                computedValue: c.computedValue ?? ""
            }, { transaction: t });
        }

        const hasStockChange = cells.some(c => c.columnId === "col-cc-quantity-stock");
        const hasNotifiedChange = cells.some(c => c.columnId === "col-cc-quantity-notified");

        if (hasStockChange || hasNotifiedChange) {
            await syncCcRowStatusAndNotification(req.params.ccRowId, t);
        }

        if (hasStockChange) {
            const ccRow = await InvCcRow.findOne({
                where: { id: req.params.ccRowId },
                transaction: t
            });
            if (ccRow && ccRow.parentRowId) {
                await syncParentInventory(ccRow.parentRowId, t);
            }
        }

        await t.commit();
        res.json({ message: "Batch cells updated" });
    } catch (e) {
        await t.rollback();
        next(e);
    }
};

export const listAllBatches = async (req, res, next) => {
    try {
        const ccRows = await InvCcRow.findAll({
            where: { isDeleted: false },
            include: [
                { model: InvCcCell, as: "cells" },
                {
                    model: InvRow,
                    include: [{ model: InvCell, as: "cells" }]
                }
            ]
        });

        const getCellValue = (cells, colId) => {
            const cell = cells.find(c => c.columnId === colId);
            return cell ? cell.rawValue : "";
        };

        const result = ccRows.map(row => {
            const cells = row.cells || [];
            const parentRow = row.InvRow;
            const parentCells = parentRow ? (parentRow.cells || []) : [];

            const stockStr = getCellValue(cells, "col-cc-quantity-stock");
            const retailPriceStr = getCellValue(cells, "col-cc-retail-selling-rate");
            const wholesalePriceStr = getCellValue(cells, "col-cc-wholesale-selling-rate");

            return {
                ccRowId: row.id,
                name: getCellValue(parentCells, "col-product-name") || "Unnamed Product",
                batch: getCellValue(cells, "col-cc-batch") || "No Batch",
                expiry: getCellValue(cells, "col-cc-expiry-date") || "No Expiry",
                stock: stockStr ? parseFloat(stockStr) : 0,
                retailPrice: retailPriceStr ? parseFloat(retailPriceStr) : 0,
                wholesalePrice: wholesalePriceStr ? parseFloat(wholesalePriceStr) : 0,
                category: getCellValue(parentCells, "col-composition") || "General"
            };
        });

        res.json({ data: result });
    } catch (e) { next(e); }
};
