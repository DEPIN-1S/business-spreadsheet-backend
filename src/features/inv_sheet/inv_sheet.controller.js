import { Op } from "sequelize";
import sequelize from "../../config/db.js";
import InvFolder from "./inv_folder.model.js";
// Inventory Sheet Controller - Synced with Rack No, CC Meta, and InvCell
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

async function findParentInventoryCell(parentRowId, transaction) {
    let cell = await InvCell.findOne({
        where: {
            rowId: parentRowId,
            columnId: { [Op.in]: ["col-retail-inventory", "col-inventory", "col-wholesale-inventory", "col-3"] }
        },
        transaction
    });
    if (cell) return cell;

    const parentRow = await InvRow.findOne({ where: { id: parentRowId }, transaction });
    if (!parentRow) return null;

    const invColumn = await InvColumn.findOne({
        where: {
            spreadsheetId: parentRow.spreadsheetId,
            [Op.or]: [
                { type: "inventory" },
                { title: { [Op.like]: "%inventory%" } },
                { title: { [Op.like]: "%stock%" } }
            ]
        },
        transaction
    });

    if (invColumn) {
        cell = await InvCell.findOne({
            where: { rowId: parentRowId, columnId: invColumn.id },
            transaction
        });
        if (!cell && invColumn.columnId) {
            cell = await InvCell.findOne({
                where: { rowId: parentRowId, columnId: invColumn.columnId },
                transaction
            });
        }
        if (cell) return cell;
    }

    const allCells = await InvCell.findAll({ where: { rowId: parentRowId }, transaction });
    return allCells.find(c => c.columnId.includes("inventory")) || allCells[2] || allCells[0] || null;
}

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

    const mainInventoryCell = await findParentInventoryCell(parentRowId, transaction);
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
            "col-composition", "col-company-name", "col-rack-no", "col-manufacturer"
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
                if (r.ccMeta) {
                    if (r.ccMeta.rackNo) {
                        await InvCell.upsert({ rowId: r.id, columnId: "col-rack-no", rawValue: r.ccMeta.rackNo, computedValue: r.ccMeta.rackNo });
                    }
                    if (r.ccMeta.companyName) {
                        await InvCell.upsert({ rowId: r.id, columnId: "col-company-name", rawValue: r.ccMeta.companyName, computedValue: r.ccMeta.companyName });
                    }
                    if (r.ccMeta.composition) {
                        await InvCell.upsert({ rowId: r.id, columnId: "col-composition", rawValue: r.ccMeta.composition, computedValue: r.ccMeta.composition });
                    }
                    if (r.ccMeta.manufacturer) {
                        await InvCell.upsert({ rowId: r.id, columnId: "col-manufacturer", rawValue: r.ccMeta.manufacturer, computedValue: r.ccMeta.manufacturer });
                    }
                }
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

        const rows = await InvRow.findAll({ where: { spreadsheetId: req.params.id } });
        const rowIds = rows.map(r => r.id);
        if (rowIds.length > 0) {
            await InvRow.update({ isDeleted: true }, { where: { spreadsheetId: req.params.id } });
            await InvCcRow.update({ isDeleted: true }, { where: { parentRowId: rowIds } });
        }

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
            "col-composition", "col-company-name", "col-rack-no", "col-manufacturer"
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
        await InvCcRow.update({ isDeleted: true }, { where: { parentRowId: row.id } });
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

            if (c.columnId === "col-rack-no" && c.rawValue !== undefined) {
                let meta = await InvCcMeta.findOne({ where: { rowId: req.params.rowId } });
                if (meta) await meta.update({ rackNo: c.rawValue ?? "" });
                else await InvCcMeta.create({ rowId: req.params.rowId, rackNo: c.rawValue ?? "" });
            }
            if (c.columnId === "col-company-name" && c.rawValue !== undefined) {
                let meta = await InvCcMeta.findOne({ where: { rowId: req.params.rowId } });
                if (meta) await meta.update({ companyName: c.rawValue ?? "" });
                else await InvCcMeta.create({ rowId: req.params.rowId, companyName: c.rawValue ?? "" });
            }
            if (c.columnId === "col-composition" && c.rawValue !== undefined) {
                let meta = await InvCcMeta.findOne({ where: { rowId: req.params.rowId } });
                if (meta) await meta.update({ composition: c.rawValue ?? "", category: c.rawValue ?? "" });
                else await InvCcMeta.create({ rowId: req.params.rowId, composition: c.rawValue ?? "", category: c.rawValue ?? "" });
            }
            if (c.columnId === "col-manufacturer" && c.rawValue !== undefined) {
                let meta = await InvCcMeta.findOne({ where: { rowId: req.params.rowId } });
                if (meta) await meta.update({ manufacturer: c.rawValue ?? "" });
                else await InvCcMeta.create({ rowId: req.params.rowId, manufacturer: c.rawValue ?? "" });
            }
        }
        res.json({ message: "Cells updated" });
    } catch (e) { next(e); }
};

export const updateRowStyle = async (req, res, next) => {
    try {
        const row = await InvRow.findOne({ where: { id: req.params.rowId, spreadsheetId: req.params.id, isDeleted: false } });
        if (!row) throw new AppError("Row not found", 404);
        let currentStyles = row.styles || {};
        if (typeof currentStyles === "string") {
            try { currentStyles = JSON.parse(currentStyles); } catch { currentStyles = {}; }
        }
        const updatedStyles = { ...currentStyles, ...(req.body.styles || {}) };
        await row.update({ styles: updatedStyles });
        res.json({ data: row, message: "Row styles updated" });
    } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────────────────────
// CC META (6 dropdown values per product row)
// ─────────────────────────────────────────────────────────────────────────────

export const getCcMeta = async (req, res, next) => {
    try {
        const row = await InvRow.findOne({
            where: { id: req.params.rowId, isDeleted: false },
            include: [{ model: InvCell, as: "cells" }]
        });
        if (!row) throw new AppError("Row not found", 404);
        const meta = await InvCcMeta.findOne({ where: { rowId: req.params.rowId } });
        const parentCells = row.cells || [];
        const getCellValue = (cells, colId) => {
            const cell = cells.find(c => c.columnId === colId);
            return cell ? cell.rawValue : "";
        };

        const result = {
            rowId: req.params.rowId,
            gst: meta?.gst || "",
            category: meta?.category || meta?.composition || getCellValue(parentCells, "col-composition") || "",
            division: meta?.division || "",
            manufacturer: meta?.manufacturer || getCellValue(parentCells, "col-manufacturer") || "",
            companyName: meta?.companyName || getCellValue(parentCells, "col-company-name") || "",
            quantity: meta?.quantity || "",
            hsnCode: meta?.hsnCode || "",
            rackNo: meta?.rackNo || getCellValue(parentCells, "col-rack-no") || ""
        };
        res.json({ data: result });
    } catch (e) { next(e); }
};

export const updateCcMeta = async (req, res, next) => {
    try {
        const row = await InvRow.findOne({ where: { id: req.params.rowId, isDeleted: false } });
        if (!row) throw new AppError("Row not found", 404);
        const { gst, category, division, manufacturer, companyName, quantity, hsnCode, rackNo, composition } = req.body;

        let meta = await InvCcMeta.findOne({ where: { rowId: req.params.rowId } });
        if (meta) {
            await meta.update({
                ...(gst !== undefined ? { gst } : {}),
                ...(category !== undefined ? { category } : {}),
                ...(division !== undefined ? { division } : {}),
                ...(manufacturer !== undefined ? { manufacturer } : {}),
                ...(companyName !== undefined ? { companyName } : {}),
                ...(quantity !== undefined ? { quantity } : {}),
                ...(hsnCode !== undefined ? { hsnCode } : {}),
                ...(rackNo !== undefined ? { rackNo } : {}),
                ...(composition !== undefined ? { composition } : {})
            });
        } else {
            meta = await InvCcMeta.create({
                rowId: req.params.rowId,
                gst: gst || "",
                category: category || "",
                division: division || "",
                manufacturer: manufacturer || "",
                companyName: companyName || "",
                quantity: quantity || "",
                hsnCode: hsnCode || "",
                rackNo: rackNo || "",
                composition: composition || ""
            });
        }

        // Sync Rack No, Company Name, and Composition to parent InvCell records for the main spreadsheet
        if (rackNo !== undefined) {
            await InvCell.upsert({
                rowId: req.params.rowId,
                columnId: "col-rack-no",
                rawValue: rackNo ?? "",
                computedValue: rackNo ?? ""
            });
        }
        if (companyName !== undefined) {
            await InvCell.upsert({
                rowId: req.params.rowId,
                columnId: "col-company-name",
                rawValue: companyName ?? "",
                computedValue: companyName ?? ""
            });
        }
        if (composition !== undefined) {
            await InvCell.upsert({
                rowId: req.params.rowId,
                columnId: "col-composition",
                rawValue: composition ?? "",
                computedValue: composition ?? ""
            });
        }
        if (manufacturer !== undefined) {
            await InvCell.upsert({
                rowId: req.params.rowId,
                columnId: "col-manufacturer",
                rawValue: manufacturer ?? "",
                computedValue: manufacturer ?? ""
            });
        }

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
            "col-cc-wholesale-profit", "col-cc-wholesale-selling-rate", "col-cc-wholesale-margin",
            "col-cc-wholesale-mrp"
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

export const copyCcRow = async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
        const { rowId, ccRowId } = req.params;
        const originalCcRow = await InvCcRow.findOne({
            where: { id: ccRowId, parentRowId: rowId, isDeleted: false },
            transaction: t
        });
        if (!originalCcRow) throw new AppError("Batch row not found", 404);

        const newOrderIndex = (originalCcRow.orderIndex || 0) + 1;

        // Shift subsequent batch rows down by 1
        await InvCcRow.increment('orderIndex', {
            by: 1,
            where: {
                parentRowId: rowId,
                isDeleted: false,
                orderIndex: { [Op.gte]: newOrderIndex }
            },
            transaction: t
        });

        const newCcRow = await InvCcRow.create({
            parentRowId: rowId,
            orderIndex: newOrderIndex,
            status: originalCcRow.status
        }, { transaction: t });

        const cells = await InvCcCell.findAll({ where: { ccRowId: originalCcRow.id }, transaction: t });
        if (cells.length > 0) {
            const newCells = cells.map(c => {
                let rawVal = c.rawValue;
                let compVal = c.computedValue;
                let fmtVal = c.formattedValue;

                // Condition: batch no, expiry date, stock qty start empty/0 for duplicated batch row
                if (c.columnId === "col-cc-batch" || c.columnId === "col-cc-expiry-date") {
                    rawVal = "";
                    compVal = "";
                    fmtVal = "";
                } else if (c.columnId === "col-cc-quantity-stock" || c.columnId === "col-cc-quantity-notified") {
                    rawVal = "0";
                    compVal = "0";
                    fmtVal = "0";
                }

                return {
                    ccRowId: newCcRow.id,
                    columnId: c.columnId,
                    rawValue: rawVal,
                    computedValue: compVal,
                    formattedValue: fmtVal,
                    bgColor: c.bgColor
                };
            });
            await InvCcCell.bulkCreate(newCells, { transaction: t });
        }

        await syncParentInventory(rowId, t);
        await t.commit();

        const createdCcRow = await InvCcRow.findByPk(newCcRow.id, {
            include: [{ model: InvCcCell, as: "cells" }]
        });

        res.status(201).json({ data: createdCcRow, message: "Batch row duplicated" });
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

        let parentTotalStock = null;
        if (hasStockChange) {
            const ccRow = await InvCcRow.findOne({
                where: { id: req.params.ccRowId },
                transaction: t
            });
            if (ccRow && ccRow.parentRowId) {
                await syncParentInventory(ccRow.parentRowId, t);
                const parentCell = await findParentInventoryCell(ccRow.parentRowId, t);
                if (parentCell) {
                    parentTotalStock = parentCell.rawValue;
                }
            }
        }

        await t.commit();
        res.json({ message: "Batch cells updated", totalStock: parentTotalStock });
    } catch (e) {
        await t.rollback();
        next(e);
    }
};

export const updateCcRowStyle = async (req, res, next) => {
    try {
        const ccRow = await InvCcRow.findOne({ where: { id: req.params.ccRowId, parentRowId: req.params.rowId, isDeleted: false } });
        if (!ccRow) throw new AppError("CC row not found", 404);
        let currentStyles = ccRow.styles || {};
        if (typeof currentStyles === "string") {
            try { currentStyles = JSON.parse(currentStyles); } catch { currentStyles = {}; }
        }
        const updatedStyles = { ...currentStyles, ...(req.body.styles || {}) };
        await ccRow.update({ styles: updatedStyles });
        res.json({ data: ccRow, message: "CC Row styles updated" });
    } catch (e) { next(e); }
};

export const listAllBatches = async (req, res, next) => {
    try {
        const ccRows = await InvCcRow.findAll({
            where: { isDeleted: false },
            include: [
                { model: InvCcCell, as: "cells" },
                {
                    model: InvRow,
                    where: { isDeleted: false },
                    required: true,
                    include: [
                        { model: InvCell, as: "cells" },
                        { model: InvCcMeta, as: "ccMeta", required: false },
                        {
                            model: InvSpreadsheet,
                            where: { isDeleted: false },
                            required: true
                        }
                    ]
                }
            ]
        });

        const getCellValue = (cells, colId) => {
            const cell = cells.find(c => c.columnId === colId);
            return cell ? cell.rawValue : "";
        };

        const result = ccRows
            .filter(row => row.InvRow && !row.InvRow.isDeleted && row.InvRow.InvSpreadsheet && !row.InvRow.InvSpreadsheet.isDeleted)
            .map(row => {
                const cells = row.cells || [];
                const parentRow = row.InvRow;
                const parentCells = parentRow ? (parentRow.cells || []) : [];

                const productName = getCellValue(parentCells, "col-product-name");
                const batchVal = getCellValue(cells, "col-cc-batch");

                // Skip rows with no product name or no batch
                if (!productName || !batchVal) return null;

                const stockStr = getCellValue(cells, "col-cc-quantity-stock");
                const retailPriceStr = getCellValue(cells, "col-cc-retail-selling-rate");
                const wholesalePriceStr = getCellValue(cells, "col-cc-wholesale-selling-rate");
                const mrpStr = getCellValue(cells, "col-cc-wholesale-mrp") || getCellValue(cells, "col-cc-mrp");
                const discountStr = getCellValue(cells, "col-cc-discount");
                const wholesaleMarginStr = getCellValue(cells, "col-cc-wholesale-margin");

                // Use actual category from ccMeta, fallback to composition, then 'General'
                const category = row.InvRow?.ccMeta?.category
                    || getCellValue(parentCells, "col-composition")
                    || "General";

                return {
                    ccRowId: row.id,
                    name: productName || "Unnamed Product",
                    batch: batchVal || "No Batch",
                    expiry: getCellValue(cells, "col-cc-expiry-date") || "No Expiry",
                    stock: stockStr ? parseFloat(stockStr) : 0,
                    retailPrice: retailPriceStr ? parseFloat(retailPriceStr) : 0,
                    wholesalePrice: wholesalePriceStr ? parseFloat(wholesalePriceStr) : 0,
                    mrp: mrpStr ? parseFloat(mrpStr) : 0,
                    discount: discountStr ? parseFloat(discountStr) : 0,
                    wholesaleMargin: wholesaleMarginStr ? parseFloat(wholesaleMarginStr) : 0,
                    category,
                    rackNo: (row.InvRow?.ccMeta?.rackNo) || getCellValue(parentCells, "col-rack-no") || ""
                };
            })
            .filter(Boolean); // remove null entries from skipped rows

        res.json({ data: result });
    } catch (e) { next(e); }
};

export const copyRow = async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
        const { id: spreadsheetId, rowId } = req.params;
        const originalRow = await InvRow.findOne({
            where: { id: rowId, spreadsheetId, isDeleted: false },
            transaction: t
        });
        if (!originalRow) throw new AppError("Row not found", 404);

        const newOrder = originalRow.order + 1;

        // Shift subsequent rows
        await InvRow.increment('order', {
            by: 1,
            where: {
                spreadsheetId,
                isDeleted: false,
                order: { [Op.gte]: newOrder }
            },
            transaction: t
        });

        // 1. Create duplicate row
        const newRow = await InvRow.create({
            spreadsheetId,
            order: newOrder,
            rowColor: originalRow.rowColor,
            height: originalRow.height
        }, { transaction: t });

        // 2. Duplicate main cells
        const mainCells = await InvCell.findAll({ where: { rowId: originalRow.id }, transaction: t });
        if (mainCells.length > 0) {
            const newMainCells = mainCells.map(cell => ({
                rowId: newRow.id,
                columnId: cell.columnId,
                rawValue: cell.rawValue,
                computedValue: cell.computedValue,
                formattedValue: cell.formattedValue,
                bgColor: cell.bgColor,
                fileUrl: cell.fileUrl
            }));
            await InvCell.bulkCreate(newMainCells, { transaction: t });
        }

        // 3. Duplicate CC Meta dropdown settings
        const originalMeta = await InvCcMeta.findOne({ where: { rowId: originalRow.id }, transaction: t });
        if (originalMeta) {
            await InvCcMeta.create({
                rowId: newRow.id,
                gst: originalMeta.gst,
                category: originalMeta.category,
                division: originalMeta.division,
                manufacturer: originalMeta.manufacturer,
                companyName: originalMeta.companyName,
                quantity: originalMeta.quantity,
                hsnCode: originalMeta.hsnCode,
                rackNo: originalMeta.rackNo,
                composition: originalMeta.composition
            }, { transaction: t });
        }

        // 4. Duplicate Sub-Table Batch Rows (InvCcRow & InvCcCell)
        const ccRows = await InvCcRow.findAll({
            where: { parentRowId: originalRow.id, isDeleted: false },
            order: [["orderIndex", "ASC"]],
            transaction: t
        });

        for (const ccRow of ccRows) {
            const newCcRow = await InvCcRow.create({
                parentRowId: newRow.id,
                orderIndex: ccRow.orderIndex || 0,
                status: ccRow.status
            }, { transaction: t });

            const ccCells = await InvCcCell.findAll({ where: { ccRowId: ccRow.id }, transaction: t });
            if (ccCells.length > 0) {
                const newCcCells = ccCells.map(c => {
                    let rawVal = c.rawValue;
                    let compVal = c.computedValue;
                    let fmtVal = c.formattedValue;

                    // Condition: When row is duplicated, batch no, expiry date, and stock qty start empty/0
                    if (c.columnId === "col-cc-batch" || c.columnId === "col-cc-expiry-date") {
                        rawVal = "";
                        compVal = "";
                        fmtVal = "";
                    } else if (c.columnId === "col-cc-quantity-stock" || c.columnId === "col-cc-quantity-notified") {
                        rawVal = "0";
                        compVal = "0";
                        fmtVal = "0";
                    }

                    return {
                        ccRowId: newCcRow.id,
                        columnId: c.columnId,
                        rawValue: rawVal,
                        computedValue: compVal,
                        formattedValue: fmtVal,
                        bgColor: c.bgColor
                    };
                });
                await InvCcCell.bulkCreate(newCcCells, { transaction: t });
            }
        }

        // 5. Sync total retail inventory stock for the new row
        await syncParentInventory(newRow.id, t);

        await t.commit();

        // Fetch full new row with main cells and CC rows for response
        const createdRow = await InvRow.findByPk(newRow.id, {
            include: [
                { model: InvCell, as: "cells" },
                {
                    model: InvCcRow,
                    as: "ccRows",
                    where: { isDeleted: false },
                    required: false,
                    include: [{ model: InvCcCell, as: "cells" }]
                }
            ]
        });

        res.status(201).json({ data: createdRow, message: "Inventory row duplicated successfully" });
    } catch (e) {
        await t.rollback();
        next(e);
    }
};
