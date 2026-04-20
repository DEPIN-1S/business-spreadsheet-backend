import Spreadsheet from "./spreadsheet.model.js";
import Column from "./column.model.js";
import Row from "./row.model.js";
import Cell from "./cell.model.js";
import SheetPermission from "./permission.model.js";
import ColumnPermission from "./column_permission.model.js";
import FolderPermission from "./folder_permission.model.js";
import Folder from "./folder.model.js";
import { evaluate, resolveColumnNames } from "../../utils/formulaEngine.js";
import { parseCurrencyInput, formatCurrencyValue } from "../../utils/currencyHelpers.js";
import { buildGraph, checkCircular, topoSort } from "../../utils/dependencyGraph.js";
import { logAction } from "../../utils/auditLogger.js";
import AppError from "../../utils/AppError.js";
import { getPagination, getMeta } from "../../utils/pagination.js";
import { getIO } from "../../config/socket.js";
import { Op } from "sequelize";
import logger from "../../config/logger.js";
import User from "../user/user.model.js";
import sequelize from "../../config/db.js";
import { getInheritedPermission } from "../../middleware/rbac.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function indexToLetter(idx) {
    let letter = "";
    let n = idx;
    do {
        letter = String.fromCharCode(65 + (n % 26)) + letter;
        n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return letter;
}

async function buildCellMap(spreadsheetId) {
    const columns = await Column.findAll({ where: { spreadsheetId, isDeleted: false }, order: [["orderIndex", "ASC"]] });
    const rows = await Row.findAll({ where: { spreadsheetId, isDeleted: false }, order: [["order", "ASC"]] });
    const cells = rows.length && columns.length
        ? await Cell.findAll({ where: { rowId: rows.map(r => r.id), columnId: columns.map(c => c.id) } })
        : [];

    const colIndexMap = {};
    columns.forEach((col, i) => { colIndexMap[col.id] = indexToLetter(i); });
    const rowIndexMap = {};
    rows.forEach((row, i) => { rowIndexMap[row.id] = i + 1; });

    const cellMap = {};
    cells.forEach(cell => {
        const colLetter = colIndexMap[cell.columnId];
        const rowNum = rowIndexMap[cell.rowId];
        if (colLetter && rowNum) {
            cellMap[`${colLetter}${rowNum}`] = cell.computedValue ?? cell.rawValue ?? "";
        }
    });

    return { cellMap, columns, rows, cells, colIndexMap, rowIndexMap };
}

// ── Get Sheet Data (with column privacy + pagination) ────────────────────────
export const getSheetData = async (req, res, next) => {
    try {
        const { id: spreadsheetId } = req.params;
        const { role, id: userId } = req.user;
        const { page, limit, offset } = getPagination(req);

        const [sheet, columnsRaw] = await Promise.all([
            Spreadsheet.findOne({ where: { id: spreadsheetId, isDeleted: false } }),
            Column.findAll({
                where: { spreadsheetId, isDeleted: false, isHidden: false },
                order: [["orderIndex", "ASC"]]
            })
        ]);

        if (!sheet) throw new AppError("Spreadsheet not found", 404);
        let columns = columnsRaw;

        // Column privacy and permission mapping
        let columnPermissionsMap = {}; // { colId: 'edit' | 'view' }
        if (role === "staff") {
            // Check direct sheet permission
            let sheetPerm = await SheetPermission.findOne({ where: { userId, spreadsheetId } });
            
            // Check if user is the owner (creator)
            if (!sheetPerm && sheet.createdBy === userId) {
                sheetPerm = {
                    canView: true,
                    canEdit: true,
                    role: 'admin'
                };
            }

            // Check inherited folder permission (recursively) if no direct/owner access
            if (!sheetPerm && sheet.folderId) {
                const folderPerm = await getInheritedPermission(userId, sheet.folderId);
                if (folderPerm) {
                    sheetPerm = {
                        canView: true,
                        canEdit: folderPerm.canEdit,
                        role: folderPerm.canEdit ? "editor" : "viewer"
                    };
                }
            }

            const colPerm = await ColumnPermission.findOne({ where: { userId, spreadsheetId } });
            if (colPerm && colPerm.columnAccess) {
                columnPermissionsMap = typeof colPerm.columnAccess === 'string' 
                    ? JSON.parse(colPerm.columnAccess) 
                    : colPerm.columnAccess;
                // Filter columns to only those explicitly granted 'view' or 'edit'
                columns = columns.filter(c => columnPermissionsMap[c.id]);
            } else if (sheetPerm && sheetPerm.canView) {
                // If user has sheet access (direct, owner, or inherited) but NO explicit ColumnPermission, allow access to all columns
                columns.forEach(c => { columnPermissionsMap[c.id] = (sheetPerm.canEdit ? 'edit' : 'view'); });
            } else {
                // Secure by default: no columns if no permission found
                columns = [];
            }
        } else {
            // Admin/SuperAdmin see all and can edit all
            columns.forEach(c => { columnPermissionsMap[c.id] = 'edit'; });
        }

        // Attach permission to each column object for frontend consumption
        columns = columns.map(c => {
            const colJson = c.toJSON ? c.toJSON() : c;
            return {
                ...colJson,
                permission: columnPermissionsMap[c.id] || 'view'
            };
        });

        const search = req.query.search;
        let rowInclude = [];

        if (search && search.trim().length > 0) {
            const searchKeyword = search.trim();
            rowInclude.push({
                model: Cell,
                as: 'cells',
                attributes: [],
                where: {
                    [Op.or]: [
                        { rawValue: { [Op.like]: `${searchKeyword}%` } },
                        { computedValue: { [Op.like]: `${searchKeyword}%` } },
                        { formattedValue: { [Op.like]: `${searchKeyword}%` } }
                    ]
                },
                required: true // INNER JOIN to filter rows
            });
        }

        const { count: totalRows, rows } = await Row.findAndCountAll({
            where: { spreadsheetId, isDeleted: false },
            order: [["order", "ASC"]],
            include: rowInclude,
            distinct: true
        });

        const rowIds = rows.map(r => r.id);
        const colIds = columns.map(c => c.id);

        const cells = rowIds.length && colIds.length
            ? await Cell.findAll({ where: { rowId: rowIds, columnId: colIds } })
            : [];

        const cellIdx = {};
        cells.forEach(c => { cellIdx[`${c.rowId}_${c.columnId}`] = c; });

        const grid = rows.map((row, ri) => ({
            id: row.id,
            order: row.order,
            rowColor: row.rowColor,
            isBold: row.isBold,
            isItalic: row.isItalic,
            isLocked: row.isLocked,
            nestedSheetId: row.nestedSheetId,
            cells: columns.map((col, ci) => {
                const cell = cellIdx[`${row.id}_${col.id}`];
                let fValue = cell?.formattedValue ?? null;
                if (col.type === 'currency' && cell?.computedValue !== null && cell?.computedValue !== undefined) {
                    fValue = formatCurrencyValue(parseFloat(cell.computedValue), cell.currencyCode || col.currencyCode) || fValue;
                }
                return {
                    id: cell?.id || null,
                    columnId: col.id,
                    columnName: col.name,
                    columnType: col.type,
                    permission: columnPermissionsMap[col.id] || 'view', // 'edit' or 'view'
                    rawValue: cell?.rawValue ?? null,
                    formattedValue: fValue,
                    computedValue: cell?.computedValue ?? null,
                    currencyCode: cell?.currencyCode ?? null,
                    fileUrl: cell?.fileUrl ?? null,
                    bgColor: cell?.bgColor ?? null,
                    isBold: cell?.isBold ?? false,
                    isItalic: cell?.isItalic ?? false,
                    nestedSheetId: cell?.nestedSheetId ?? null,
                    ref: `${indexToLetter(ci)}${ri + 1 + offset}`
                };
            })
        }));

        res.json({
            data: { 
                sheet: {
                    ...sheet.toJSON(),
                    userPermission: (role === 'admin' || role === 'superadmin') ? 'admin' : (req.sheetPermission?.role || 'viewer')
                }, 
                columns, 
                grid 
            },
            meta: getMeta(page, limit, totalRows)
        });
    } catch (e) {
        console.error("FULL DB ERROR:", e);
        if (e.sql) console.error("SQL:", e.sql);
        next(e);
    }

};

// ── Update a cell (with formula recalc + socket emit) ────────────────────────
export const updateCell = async (req, res, next) => {
    try {
        const { id: spreadsheetId, cellId } = req.params;
        const { rawValue, formattedValue, fileUrl, currencyCode, bgColor, isBold, isItalic, nestedSheetId } = req.body;

        if (req.user.role === "staff") {
            const perm = await SheetPermission.findOne({ where: { userId: req.user.id, spreadsheetId } });
            if (!perm || !perm.canEdit) throw new AppError("Edit access denied", 403);
        }

        let cell = await Cell.findByPk(cellId);
        if (!cell) throw new AppError("Cell not found", 404);

        const oldValue = cell.rawValue;
        const columnId = cell.columnId;
        const col = await Column.findByPk(columnId);
        
        // Granular permission check for staff
        if (req.user.role === "staff") {
            const colPerm = await ColumnPermission.findOne({ where: { userId: req.user.id, spreadsheetId } });
            if (!colPerm) throw new AppError("You do not have permission to edit this column", 403);
            
            const access = typeof colPerm.columnAccess === 'string' ? JSON.parse(colPerm.columnAccess) : (colPerm.columnAccess || {});
            if (access[columnId] !== 'edit') {
                throw new AppError("You do not have permission to edit this column", 403);
            }
        }
        
        let finalRaw = rawValue;
        let finalFormatted = formattedValue ?? rawValue;
        if (rawValue !== undefined) {
            if (col.type === "currency") {
                finalRaw = parseCurrencyInput(rawValue);
                finalFormatted = formatCurrencyValue(parseFloat(finalRaw), currencyCode || cell.currencyCode || col.currencyCode);
            } else if (col.type === "date" && rawValue) {
                const d = new Date(rawValue);
                if (!isNaN(d.getTime())) {
                    finalRaw = d.toISOString().slice(0, 10);
                    finalFormatted = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
                }
            } else if (col.type === "number" && rawValue !== "" && !isNaN(parseFloat(rawValue))) {
                const num = parseFloat(rawValue);
                finalRaw = String(num);
                // Round to 1 decimal place for display
                finalFormatted = String(parseFloat(num.toFixed(1)));
            }
        }

        if (col?.validationRules && finalRaw !== undefined) validateCellValue(finalRaw, col);

        const updateData = {};
        if (finalRaw !== undefined) updateData.rawValue = finalRaw;
        if (finalFormatted !== undefined) updateData.formattedValue = finalFormatted;
        // For number columns, ensure computedValue is synchronized with the rounded formattedValue
        if (col.type === "number" && finalFormatted !== undefined) {
            updateData.computedValue = finalFormatted;
        } else if (finalRaw !== undefined) {
            updateData.computedValue = finalRaw;
        }
        if (fileUrl !== undefined) updateData.fileUrl = fileUrl;
        if (bgColor !== undefined) updateData.bgColor = bgColor;
        if (isBold !== undefined) updateData.isBold = isBold;
        if (isItalic !== undefined) updateData.isItalic = isItalic;
        if (currencyCode !== undefined) updateData.currencyCode = currencyCode;
        if (nestedSheetId !== undefined) updateData.nestedSheetId = nestedSheetId;
        updateData.updatedBy = req.user.id;

        await cell.update(updateData);

        const updatedCells = await recalculateFormulas(spreadsheetId);
        cell = await Cell.findByPk(cellId);

        // Socket emit — delta update only
        const io = getIO();
        if (io) {
            io.to(`sheet:${spreadsheetId}`).emit("cell_updated", {
                sheetId: spreadsheetId,
                cellId,
                columnId: cell.columnId,
                rowId: cell.rowId,
                rawValue: cell.rawValue,
                formattedValue: cell.formattedValue,
                computedValue: cell.computedValue,
                updatedBy: req.user.id,
                at: new Date().toISOString()
            });
            if (updatedCells.length) {
                io.to(`sheet:${spreadsheetId}`).emit("formula_recalculated", { sheetId: spreadsheetId, cells: updatedCells });
            }
        }

        await logAction(req.user.id, "cell", cellId, "update", { rawValue: oldValue }, { rawValue, computedValue: cell.computedValue }, req, { spreadsheetId });
        res.json({ data: cell, message: "Cell updated" });
    } catch (e) { next(e); }
};

// ── Upsert cell ───────────────────────────────────────────────────────────────
export const upsertCell = async (req, res, next) => {
    try {
        const { rowId, columnId, rawValue, fileUrl, formattedValue, currencyCode, bgColor, isBold, isItalic, nestedSheetId } = req.body;
        const { id: spreadsheetId } = req.params;

        // Granular permission check for staff
        if (req.user.role === "staff") {
            const colPerm = await ColumnPermission.findOne({ where: { userId: req.user.id, spreadsheetId } });
            if (!colPerm) throw new AppError("You do not have permission to edit this column", 403);
            
            const access = typeof colPerm.columnAccess === 'string' ? JSON.parse(colPerm.columnAccess) : (colPerm.columnAccess || {});
            if (access[columnId] !== 'edit') {
                throw new AppError("You do not have permission to edit this column", 403);
            }
        }

        const col = await Column.findByPk(columnId);
        
        let finalRaw = rawValue;
        let finalFormatted = formattedValue ?? rawValue;
        if (rawValue !== undefined) {
            if (col.type === "currency") {
                finalRaw = parseCurrencyInput(rawValue);
                finalFormatted = formatCurrencyValue(parseFloat(finalRaw), currencyCode || col.currencyCode);
            } else if (col.type === "date" && rawValue) {
                const d = new Date(rawValue);
                if (!isNaN(d.getTime())) {
                    finalRaw = d.toISOString().slice(0, 10);
                    finalFormatted = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
                }
            } else if (col.type === "number" && rawValue !== "" && !isNaN(parseFloat(rawValue))) {
                const num = parseFloat(rawValue);
                finalRaw = String(num);
                // Round to 1 decimal place for display
                finalFormatted = String(parseFloat(num.toFixed(1)));
            }
        }

        if (col?.validationRules && finalRaw !== undefined) validateCellValue(finalRaw, col);

        let cell = await Cell.findOne({ where: { rowId, columnId } });
        if (cell) {
            const updateData = {};
            if (finalRaw !== undefined) updateData.rawValue = finalRaw;
            if (finalFormatted !== undefined) updateData.formattedValue = finalFormatted;
            // For number columns, ensure computedValue is synchronized with the rounded formattedValue
            if (col.type === "number" && finalFormatted !== undefined) {
                updateData.computedValue = finalFormatted;
            } else if (finalRaw !== undefined) {
                updateData.computedValue = finalRaw;
            }
            if (fileUrl !== undefined) updateData.fileUrl = fileUrl;
            if (bgColor !== undefined) updateData.bgColor = bgColor;
            if (isBold !== undefined) updateData.isBold = isBold;
            if (isItalic !== undefined) updateData.isItalic = isItalic;
            if (currencyCode !== undefined) updateData.currencyCode = currencyCode;
            if (nestedSheetId !== undefined) updateData.nestedSheetId = nestedSheetId;
            updateData.updatedBy = req.user.id;
            await cell.update(updateData);
        } else {
            cell = await Cell.create({
                rowId, columnId, 
                rawValue: finalRaw ?? null, 
                formattedValue: finalFormatted ?? finalRaw ?? null, 
                computedValue: (col.type === "number" && finalFormatted) ? finalFormatted : (finalRaw ?? null), 
                currencyCode, fileUrl, bgColor, 
                isBold: isBold ?? false,
                isItalic: isItalic ?? false,
                nestedSheetId: nestedSheetId ?? null,
                updatedBy: req.user.id
            });
        }

        const updatedCells = await recalculateFormulas(spreadsheetId);
        const cellResult = Array.isArray(cell) ? cell[0] : cell;

        const io = getIO();
        if (io) {
            io.to(`sheet:${spreadsheetId}`).emit("cell_updated", {
                sheetId: spreadsheetId,
                cellId: cellResult.id,
                columnId, rowId, rawValue,
                formattedValue: cellResult.formattedValue,
                computedValue: cellResult.computedValue,
                nestedSheetId: cellResult.nestedSheetId,
                updatedBy: req.user.id,
                at: new Date().toISOString()
            });
            if (updatedCells.length) {
                io.to(`sheet:${spreadsheetId}`).emit("formula_recalculated", { sheetId: spreadsheetId, cells: updatedCells });
            }
        }

        res.json({ data: cell, message: "Cell saved" });
    } catch (e) { next(e); }
};

export async function recalculateFormulas(spreadsheetId, targetRowId = null) {
    const columns = await Column.findAll({ where: { spreadsheetId, isDeleted: false }, order: [["orderIndex", "ASC"]] });
    const formulaCols = columns.filter(c => c.formulaExpr); // Include any column with a formula expression
    if (!formulaCols.length) return [];

    const graph = buildGraph(columns.map(c => c.toJSON()));
    const order = topoSort(graph);
    
    // Determine which rows to process
    const rowWhere = { spreadsheetId, isDeleted: false };
    if (targetRowId) rowWhere.id = targetRowId;
    
    const rows = await Row.findAll({ where: rowWhere, order: [["order", "ASC"]] });

    // Build column-letter mapping
    const colLetterMap = {};
    const colInfoForResolve = [];
    columns.forEach((col, i) => {
        const letter = indexToLetter(i);
        colLetterMap[col.id] = letter;
        colInfoForResolve.push({ name: col.name, colLetter: letter });
    });

    // Build rowIndex mapping (needed for resolving A1 refs)
    // We still need to know the global row index even if processing one row
    const allRowsBasic = await Row.findAll({ 
        where: { spreadsheetId, isDeleted: false }, 
        attributes: ['id'], 
        order: [["order", "ASC"]] 
    });
    const rowIndexMap = {};
    allRowsBasic.forEach((r, i) => { rowIndexMap[r.id] = i + 1; });

    // Build cellMap for dependencies
    // For large sheets, we might only fetch cells for relevant columns, but let's stick to the current logic for safety
    const colIds = columns.map(c => c.id);
    const allCells = colIds.length
        ? await Cell.findAll({ where: { columnId: colIds } })
        : [];
    
    const cellMap = {};
    allCells.forEach(cell => {
        const colLetter = colLetterMap[cell.columnId];
        const rowNum = rowIndexMap[cell.rowId];
        if (colLetter && rowNum) {
            cellMap[`${colLetter}${rowNum}`] = cell.computedValue ?? cell.rawValue ?? "";
        }
    });

    const updatedCells = [];
    const bulkUpdatePayload = [];

    for (const row of rows) {
        const rowNum = rowIndexMap[row.id];
        for (const colId of order) {
            const col = formulaCols.find(c => c.id === colId);
            if (!col) continue;
            try {
                const resolvedFormula = resolveColumnNames(col.formulaExpr, colInfoForResolve, rowNum);
                const rawComputed = evaluate(resolvedFormula, cellMap);
                const computed = (rawComputed === null || rawComputed === undefined ||
                    (typeof rawComputed === "number" && !isFinite(rawComputed)))
                    ? 0 : rawComputed;
                
                const computedStr = String(computed);

                // Add to bulk update list
                bulkUpdatePayload.push({
                    rowId: row.id,
                    columnId: col.id,
                    rawValue: col.formulaExpr,
                    computedValue: computedStr,
                    currencyCode: col.currencyCode || null,
                    updatedBy: null
                });

                // Update cellMap so dependent formulas in the same row can use this result
                const colLetter = colLetterMap[col.id];
                if (colLetter) {
                    cellMap[`${colLetter}${rowNum}`] = computedStr;
                }

                updatedCells.push({
                    columnId: col.id,
                    rowId: row.id,
                    computedValue: computedStr
                });
            } catch (err) {
                bulkUpdatePayload.push({
                    rowId: row.id,
                    columnId: col.id,
                    rawValue: col.formulaExpr,
                    computedValue: `#ERR: ${err.message}`
                });
            }
        }
    }

    if (bulkUpdatePayload.length) {
        // Use bulkCreate with updateOnDuplicate for performance
        await Cell.bulkCreate(bulkUpdatePayload, {
            updateOnDuplicate: ["computedValue", "rawValue", "currencyCode", "updatedBy"]
        });
    }

    return updatedCells;
}

// ── Cell value validation ─────────────────────────────────────────────────────
function validateCellValue(value, col) {
    if (value === undefined) return; // Color-only update, skip validation
    const rules = col.validationRules || {};
    if (rules.required && (value === null || value === undefined || value === "")) {
        throw new AppError(`Column "${col.name}" is required`, 422);
    }
    if (col.type === "number" && value !== "" && value !== null) {
        const num = parseFloat(value);
        if (isNaN(num)) throw new AppError(`Column "${col.name}" must be a number`, 422);
        if (rules.min !== undefined && num < rules.min) throw new AppError(`Column "${col.name}" must be ≥ ${rules.min}`, 422);
        if (rules.max !== undefined && num > rules.max) throw new AppError(`Column "${col.name}" must be ≤ ${rules.max}`, 422);
    }
    if (col.type === "dropdown" && value) {
        const opts = col.options || [];
        if (opts.length && !opts.includes(value)) throw new AppError(`"${value}" is not a valid option for column "${col.name}"`, 422);
    }
    if (col.type === "date" && value !== "" && value !== null) {
        const d = new Date(value);
        if (isNaN(d.getTime())) {
            throw new AppError(`Column "${col.name}" requires a valid date (YYYY-MM-DD)`, 422);
        }
    }
    if (col.type === "multi_image" && value) {
        try {
            const arr = JSON.parse(value);
            if (!Array.isArray(arr)) {
                throw new AppError(`Column "${col.name}" requires a valid array of image objects`, 422);
            }
        } catch (err) {
            throw new AppError(`Column "${col.name}" requires a valid JSON string`, 422);
        }
    }
}

// ── Row management ────────────────────────────────────────────────────────────
export const addRow = async (req, res, next) => {
    try {
        const { id: spreadsheetId } = req.params;
        const { rowColor, height, isBold, isItalic, targetRowId, position } = req.body;
        
        let newOrder;
        
        if (targetRowId && position) {
            const targetRow = await Row.findByPk(targetRowId);
            if (!targetRow) throw new AppError("Target row not found", 404);
            
            newOrder = position === 'above' ? targetRow.order : targetRow.order + 1;
            
            // Shift subsequent rows
            await Row.increment('order', {
                by: 1,
                where: {
                    spreadsheetId,
                    isDeleted: false,
                    order: { [Op.gte]: newOrder }
                }
            });
        } else {
            const count = await Row.count({ where: { spreadsheetId, isDeleted: false } });
            newOrder = count;
        }
        
        const row = await Row.create({ 
            spreadsheetId, 
            order: newOrder, 
            rowColor, 
            height,
            isBold: isBold ?? false,
            isItalic: isItalic ?? false
        });

        const io = getIO();
        if (io) io.to(`sheet:${spreadsheetId}`).emit("row_updated", { action: "added", sheetId: spreadsheetId, row: row.toJSON() });

        await logAction(req.user.id, "row", row.id, "create", null, { spreadsheetId }, req);
        res.status(201).json({ data: row, message: "Row added" });
    } catch (e) { next(e); }
};

export const deleteRow = async (req, res, next) => {
    try {
        const { id: spreadsheetId, rowId } = req.params;
        const row = await Row.findByPk(rowId);
        if (!row) throw new AppError("Row not found", 404);
        await row.update({ isDeleted: true });

        const io = getIO();
        if (io) io.to(`sheet:${spreadsheetId}`).emit("row_updated", { action: "deleted", sheetId: spreadsheetId, rowId });

        await logAction(req.user.id, "row", row.id, "delete", null, null, req);
        res.json({ message: "Row deleted" });
    } catch (e) { next(e); }
};

export const reorderRow = async (req, res, next) => {
    try {
        const { id: spreadsheetId, rowId } = req.params;
        const { newOrder } = req.body;
        if (newOrder === undefined) throw new AppError("newOrder is required", 400);

        const row = await Row.findByPk(rowId);
        if (!row) throw new AppError("Row not found", 404);

        await row.update({ order: newOrder });

        const io = getIO();
        if (io) io.to(`sheet:${spreadsheetId}`).emit("row_updated", { action: "reordered", sheetId: spreadsheetId, rowId, newOrder });

        res.json({ data: row, message: "Row reordered" });
    } catch (e) { next(e); }
};

export const updateRowColor = async (req, res, next) => {
    try {
        const { id: spreadsheetId, rowId } = req.params;
        const { rowColor, isBold, isItalic, nestedSheetId } = req.body;

        const row = await Row.findByPk(rowId);
        if (!row) throw new AppError("Row not found", 404);
        const patchData = {};
        if (rowColor !== undefined) patchData.rowColor = rowColor || null;
        if (isBold !== undefined) patchData.isBold = isBold;
        if (isItalic !== undefined) patchData.isItalic = isItalic;
        if (nestedSheetId !== undefined) patchData.nestedSheetId = nestedSheetId || null;
        
        await row.update(patchData);

        const io = getIO();
        if (io) io.to(`sheet:${spreadsheetId}`).emit("row_updated", { action: "color_changed", sheetId: spreadsheetId, rowId, rowColor });

        res.json({ data: row, message: "Row color updated" });
    } catch (e) { next(e); }
};

export const copyRow = async (req, res, next) => {
    try {
        const { id: spreadsheetId, rowId } = req.params;
        const originalRow = await Row.findByPk(rowId);
        if (!originalRow) throw new AppError("Row not found", 404);

        const newOrder = originalRow.order + 1;
        
        // Shift subsequent rows
        await Row.increment('order', {
            by: 1,
            where: {
                spreadsheetId,
                isDeleted: false,
                order: { [Op.gte]: newOrder }
            }
        });
        
        let newRow;
        await sequelize.transaction(async (t) => {
            newRow = await Row.create({ 
                spreadsheetId, 
                order: newOrder, 
                rowColor: originalRow.rowColor, 
                height: originalRow.height,
                isBold: originalRow.isBold,
                isItalic: originalRow.isItalic
            }, { transaction: t });

            const cells = await Cell.findAll({ where: { rowId: originalRow.id } });
            const newCells = cells.map(cell => ({
                rowId: newRow.id,
                columnId: cell.columnId,
                rawValue: cell.rawValue,
                formattedValue: cell.formattedValue,
                computedValue: cell.computedValue,
                bgColor: cell.bgColor,
                isBold: cell.isBold,
                isItalic: cell.isItalic,
                currencyCode: cell.currencyCode,
                fileUrl: cell.fileUrl,
                updatedBy: req.user.id
            }));

            if (newCells.length) {
                await Cell.bulkCreate(newCells, { transaction: t });
            }
        });

        const io = getIO();
        if (io) io.to(`sheet:${spreadsheetId}`).emit("row_updated", { action: "added", sheetId: spreadsheetId, row: newRow.toJSON() });

        res.status(201).json({ data: newRow, message: "Row copied" });
    } catch (e) { next(e); }
};

export const bulkInsertRows = async (req, res, next) => {
    try {
        const { id: spreadsheetId } = req.params;
        const { rows: rowsData } = req.body; // [{ cells: [{columnId, rawValue}] }]
        if (!Array.isArray(rowsData) || !rowsData.length) throw new AppError("rows array is required", 400);

        const existingCount = await Row.count({ where: { spreadsheetId, isDeleted: false } });
        const createdRows = [];

        await sequelize.transaction(async (t) => {
            for (let i = 0; i < rowsData.length; i++) {
                const row = await Row.create({ spreadsheetId, order: existingCount + i }, { transaction: t });
                const cellsToCreate = (rowsData[i].cells || []).map(c => ({
                    rowId: row.id,
                    columnId: c.columnId,
                    rawValue: c.rawValue ?? null,
                    formattedValue: c.rawValue ?? null,
                    computedValue: c.rawValue ?? null,
                    updatedBy: req.user.id
                }));
                if (cellsToCreate.length) await Cell.bulkCreate(cellsToCreate, { transaction: t, ignoreDuplicates: true });
                createdRows.push(row);
            }
        });

        await recalculateFormulas(spreadsheetId);
        res.status(201).json({ data: createdRows, message: `${createdRows.length} rows inserted` });
    } catch (e) { next(e); }
};

// ── List User Sheets (Owned + Shared) ────────────────────────────────────────
export const listSheets = async (req, res, next) => {
    try {
        const { id: userId, role } = req.user;
        const { page, limit, offset } = getPagination(req);
        const { folderId, shared } = req.query;

        let whereSpreadsheet = { isDeleted: false, isDetailedView: false };
        if (folderId) whereSpreadsheet.folderId = folderId;

        if (shared === "true") {
            // Only shared with me
            const perms = await SheetPermission.findAll({ where: { userId }, attributes: ["spreadsheetId", "role"] });
            const sharedIds = perms.map(p => p.spreadsheetId);
            whereSpreadsheet.id = sharedIds;
            whereSpreadsheet.createdBy = { [Op.ne]: userId }; // Exclude owned
        } else if (role !== "superadmin" && role !== "admin") {
            // For normal users, "My Files" means owned by them
            whereSpreadsheet.createdBy = userId;
        }

        const { rows, count } = await Spreadsheet.findAndCountAll({
            where: whereSpreadsheet,
            limit, offset,
            order: [["createdAt", "DESC"]],
            include: [{ model: User, as: "creator", attributes: ["id", "name", "email", "phone", "avatar"] }]
        });

        // Add role info if shared
        const sheetPermissions = await SheetPermission.findAll({ where: { userId }, attributes: ["spreadsheetId", "role"] });
        const permMap = {};
        sheetPermissions.forEach(p => { permMap[p.spreadsheetId] = p.role; });

        const data = rows.map(sheet => ({
            ...sheet.toJSON(),
            permissionRole: sheet.createdBy === userId ? "owner" : (permMap[sheet.id] || "viewer")
        }));

        res.json({ data, meta: getMeta(page, limit, count) });
    } catch (e) { next(e); }
};

// ── Sharing & Permissions ─────────────────────────────────────────────────────

export const shareSheet = async (req, res, next) => {
    try {
        const { id: spreadsheetId } = req.params;
        const { phone, email, role = "viewer", columnAccess } = req.body;
        logger.info(`[DEBUG] shareSheet: sheetId=${spreadsheetId}, phone=${phone}, email=${email}, role=${role}, hasColumnAccess=${columnAccess !== undefined}`);

        const sheet = await Spreadsheet.findOne({ where: { id: spreadsheetId, isDeleted: false } });
        if (!sheet) throw new AppError("Spreadsheet not found", 404);

        const user = phone 
            ? await User.findOne({ where: { phone } })
            : await User.findOne({ where: { email } });

        if (!user) throw new AppError("User not found", 404);

        const canView = true;
        const canEdit = role === "editor" || role === "admin";
        const canEditFormulas = role === "admin";

        const [perm, created] = await SheetPermission.upsert(
            { userId: user.id, spreadsheetId, role, canView, canEdit, canEditFormulas, restrictedColumns: [], invitedBy: req.user.id },
            { returning: true }
        );
        logger.info(`[DEBUG] SheetPermission upserted: ${created ? 'created' : 'updated'}`);

        if (columnAccess !== undefined) {
            logger.info(`[DEBUG] Upserting ColumnPermission for user=${user.id}, sheet=${spreadsheetId}`);
            const [cp, cpCreated] = await ColumnPermission.upsert(
                { userId: user.id, spreadsheetId, columnAccess },
                { returning: true }
            );
            logger.info(`[DEBUG] ColumnPermission upserted: ${cpCreated ? 'created' : 'updated'}`);
        }

        await logAction(req.user.id, "permission", spreadsheetId, created ? "create" : "update", null,
            { userId: user.id, role, canView, canEdit, columnAccess }, req, { spreadsheetId });

        res.status(created ? 201 : 200).json({ data: Array.isArray(perm) ? perm[0] : perm, message: "Sheet shared" });
    } catch (e) { 
        logger.error(`[DEBUG] shareSheet FAILED: ${e.message}`);
        next(e); 
    }
};

export const updateShareRole = async (req, res, next) => {
    try {
        const { id: spreadsheetId, userId } = req.params;
        const { role } = req.body;
        const perm = await SheetPermission.findOne({ where: { spreadsheetId, userId } });
        if (!perm) throw new AppError("Permission not found", 404);

        const canView = true;
        const canEdit = role === "editor" || role === "admin";
        const canEditFormulas = role === "admin";

        await perm.update({ role, canView, canEdit, canEditFormulas });
        await logAction(req.user.id, "permission", spreadsheetId, "update_role", { oldRole: perm.role }, { userId, role }, req, { spreadsheetId });
        res.json({ message: "Share role updated", data: perm });
    } catch (e) { next(e); }
};

export const removeShare = async (req, res, next) => {
    try {
        const { id: spreadsheetId, userId } = req.params;
        const perm = await SheetPermission.findOne({ where: { spreadsheetId, userId } });
        if (!perm) throw new AppError("Permission not found", 404);
        await perm.destroy();
        await ColumnPermission.destroy({ where: { sheetId: spreadsheetId, userId } });
        await logAction(req.user.id, "permission", spreadsheetId, "delete", perm.toJSON(), null, req, { spreadsheetId });
        res.json({ message: "Access removed" });
    } catch (e) { next(e); }
};

export const getSharedWithMe = async (req, res, next) => {
    try {
        const { page, limit, offset } = getPagination(req);
        const perms = await SheetPermission.findAll({ where: { userId: req.user.id } });
        const sheetIds = perms.map(p => p.spreadsheetId);
        const { rows, count } = await Spreadsheet.findAndCountAll({
            where: { id: sheetIds, isDeleted: false },
            limit, offset, order: [["createdAt", "DESC"]],
            include: [{ model: User, as: "creator", attributes: ["id", "name", "email", "avatar"] }]
        });
        const data = rows.map(sheet => {
            const p = perms.find(perm => perm.spreadsheetId === sheet.id);
            return { ...sheet.toJSON(), permissionRole: p ? p.role : "viewer" };
        });
        res.json({ data, meta: getMeta(page, limit, count) });
    } catch (e) { next(e); }
};

export const listPermissions = async (req, res, next) => {
    try {
        const spreadsheetId = req.params.id;
        logger.info(`[DEBUG] Fetching permissions for spreadsheetId: ${spreadsheetId}`);
        const perms = await SheetPermission.findAll({
            where: { spreadsheetId },
            include: [{ model: User, attributes: ["id", "name", "email", "role", "avatar"] }]
        });
        const colPerms = await ColumnPermission.findAll({ where: { spreadsheetId } });
        
        const parsedColPerms = colPerms.map(cp => {
            const json = cp.toJSON();
            if (typeof json.columnAccess === 'string') {
                try { json.columnAccess = JSON.parse(json.columnAccess); } catch(e){}
            }
            return json;
        });

        logger.info(`[DEBUG] Found ${perms.length} sheet permissions, ${colPerms.length} column permissions`);
        res.json({ data: { sheetPermissions: perms, columnPermissions: parsedColPerms } });
    } catch (e) { next(e); }
};

export const setPermission = shareSheet;

// ── Spreadsheet & Column Management ──────────────────────────────────────────

export const createSheet = async (req, res, next) => {
    try {
        const { name, description, folderId, settings, isDetailedView, columns: initialColumns } = req.body;
        if (folderId) {
            const folder = await Folder.findOne({ where: { id: folderId, isDeleted: false } });
            if (!folder) throw new AppError("Folder not found", 404);
        }
        let sheet;
        await sequelize.transaction(async (t) => {
            sheet = await Spreadsheet.create({ 
                name, 
                description, 
                folderId: folderId || null, 
                settings, 
                isDetailedView: !!isDetailedView,
                createdBy: req.user.id 
            }, { transaction: t });
            
            let columnsToCreate = [];
            if (initialColumns && Array.isArray(initialColumns) && initialColumns.length > 0) {
                columnsToCreate = initialColumns.map((col, idx) => ({
                    spreadsheetId: sheet.id,
                    name: col.name,
                    type: col.type || 'text',
                    orderIndex: idx,
                    width: col.width || 220
                }));
            } else {
                columnsToCreate = [
                    { spreadsheetId: sheet.id, name: "Column 1", type: "text", orderIndex: 0 },
                    { spreadsheetId: sheet.id, name: "Column 2", type: "text", orderIndex: 1 },
                    { spreadsheetId: sheet.id, name: "Column 3", type: "text", orderIndex: 2 },
                ];
            }
            
            await Column.bulkCreate(columnsToCreate, { transaction: t });
            const defaultRows = Array.from({ length: 10 }, (_, i) => ({ spreadsheetId: sheet.id, order: i }));
            await Row.bulkCreate(defaultRows, { transaction: t });
        });
        await logAction(req.user.id, "sheet", sheet.id, "create", null, { name, folderId }, req, { spreadsheetId: sheet.id });
        res.status(201).json({ data: sheet, message: "Spreadsheet created" });
    } catch (e) { next(e); }
};

export const getSheet = async (req, res, next) => {
    try {
        const sheet = await Spreadsheet.findOne({ where: { id: req.params.id, isDeleted: false } });
        if (!sheet) throw new AppError("Spreadsheet not found", 404);
        const columns = await Column.findAll({ where: { spreadsheetId: sheet.id, isDeleted: false }, order: [["orderIndex", "ASC"]] });
        res.json({ data: { sheet, columns } });
    } catch (e) { next(e); }
};

export const updateSheet = async (req, res, next) => {
    try {
        const sheet = await Spreadsheet.findOne({ where: { id: req.params.id, isDeleted: false } });
        if (!sheet) throw new AppError("Spreadsheet not found", 404);
        const old = { name: sheet.name, description: sheet.description, folderId: sheet.folderId };
        await sheet.update(req.body);
        await logAction(req.user.id, "sheet", sheet.id, "update", old, req.body, req, { spreadsheetId: sheet.id });
        const io = getIO();
        if (io) io.to(`sheet:${sheet.id}`).emit("column_updated", { action: "sheet_updated", sheetId: sheet.id });
        res.json({ data: sheet, message: "Spreadsheet updated" });
    } catch (e) { next(e); }
};

export const deleteSheet = async (req, res, next) => {
    try {
        const sheet = await Spreadsheet.findOne({ where: { id: req.params.id, isDeleted: false } });
        if (!sheet) throw new AppError("Spreadsheet not found", 404);
        await sheet.update({ isDeleted: true });
        await logAction(req.user.id, "sheet", sheet.id, "delete", null, null, req, { spreadsheetId: sheet.id });
        res.json({ message: "Spreadsheet deleted" });
    } catch (e) { next(e); }
};


/**
 * Internal helper to duplicate a spreadsheet.
 */
export async function copySheetInternal(originalSheetId, targetFolderId, newName, userId, transaction) {
    const original = await Spreadsheet.findOne({ where: { id: originalSheetId, isDeleted: false }, transaction });
    if (!original) throw new AppError("Spreadsheet not found", 404);

    const newSheet = await Spreadsheet.create({
        name: newName || `${original.name} (Copy)`,
        description: original.description,
        folderId: targetFolderId,
        settings: original.settings,
        isDetailedView: original.isDetailedView,
        createdBy: userId
    }, { transaction });

    const columns = await Column.findAll({ where: { spreadsheetId: original.id, isDeleted: false }, order: [["orderIndex", "ASC"]], transaction });
    const columnMap = {};
    for (const col of columns) {
        const newCol = await Column.create({
            spreadsheetId: newSheet.id,
            name: col.name,
            type: col.type,
            orderIndex: col.orderIndex,
            defaultValue: col.defaultValue,
            alignment: col.alignment,
            width: col.width,
            textColor: col.textColor,
            bgColor: col.bgColor,
            isBold: col.isBold,
            isItalic: col.isItalic,
            options: col.options,
            validationRules: col.validationRules,
            formulaExpr: col.formulaExpr,
            currencyCode: col.currencyCode
        }, { transaction });
        columnMap[col.id] = newCol;
    }

    const rows = await Row.findAll({ where: { spreadsheetId: original.id, isDeleted: false }, order: [["order", "ASC"]], transaction });
    for (const row of rows) {
        const newRow = await Row.create({
            spreadsheetId: newSheet.id,
            order: row.order,
            rowColor: row.rowColor,
            height: row.height,
            isBold: row.isBold,
            isItalic: row.isItalic
        }, { transaction });

        const cells = await Cell.findAll({ where: { rowId: row.id }, transaction });
        const newCells = cells.map(cell => ({
            rowId: newRow.id,
            columnId: columnMap[cell.columnId]?.id,
            rawValue: cell.rawValue,
            formattedValue: cell.formattedValue,
            computedValue: cell.computedValue,
            bgColor: cell.bgColor,
            isBold: cell.isBold,
            isItalic: cell.isItalic,
            currencyCode: cell.currencyCode,
            fileUrl: cell.fileUrl,
            updatedBy: userId
        })).filter(c => c.columnId);

        if (newCells.length > 0) {
            await Cell.bulkCreate(newCells, { transaction });
        }
    }

    return newSheet;
}

export const duplicateSheet = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name: newRequestedName } = req.body;
        
        let newSheet;
        await sequelize.transaction(async (t) => {
            newSheet = await copySheetInternal(id, null, newRequestedName, req.user.id, t);
            // If it was in a folder, keep it in the same folder unless specified
            const original = await Spreadsheet.findByPk(id, { transaction: t });
            if (original.folderId && !req.body.folderId) {
                await newSheet.update({ folderId: original.folderId }, { transaction: t });
            }
        });

        await logAction(req.user.id, "sheet", newSheet.id, "create", null, { duplicatedFrom: id }, req, { spreadsheetId: newSheet.id });
        res.status(201).json({ data: newSheet, message: "Sheet duplicated" });
    } catch (e) { next(e); }
};

export const addColumn = async (req, res, next) => {
    try {
        const { id: spreadsheetId } = req.params;
        if (req.body.formulaExpr) {
            const cols = await Column.findAll({ where: { spreadsheetId, isDeleted: false } });
            const graph = buildGraph([...cols.map(c => c.toJSON()), { id: "NEW", name: req.body.name, formulaExpr: req.body.formulaExpr }]);
            checkCircular(graph, "NEW");
        }
        if (req.body.orderIndex === undefined) {
            const maxOrder = await Column.max("orderIndex", { where: { spreadsheetId, isDeleted: false } });
            req.body.orderIndex = (maxOrder ?? -1) + 1;
        } else {
            await Column.increment("orderIndex", { by: 1, where: { spreadsheetId, isDeleted: false, orderIndex: { [Op.gte]: req.body.orderIndex } } });
        }
        const col = await Column.create({ ...req.body, spreadsheetId });
        if (col.formulaExpr) await recalculateFormulas(spreadsheetId);
        await logAction(req.user.id, "column", col.id, "create", null, req.body, req, { spreadsheetId });
        const io = getIO();
        if (io) io.to(`sheet:${spreadsheetId}`).emit("column_updated", { action: "added", sheetId: spreadsheetId, column: col.toJSON() });
        res.status(201).json({ data: col, message: "Column added" });
    } catch (e) { next(e); }
};

export const updateColumn = async (req, res, next) => {
    try {
        const { id: spreadsheetId, colId } = req.params;
        const col = await Column.findOne({ where: { id: colId, spreadsheetId, isDeleted: false } });
        if (!col) throw new AppError("Column not found", 404);
        const old = col.toJSON();
        
        // If type is changing, clear all existing data in this column
        if (req.body.type && req.body.type !== col.type) {
            await Cell.destroy({ where: { columnId: colId } });
        }

        if (req.body.formulaExpr) {
            const cols = await Column.findAll({ where: { spreadsheetId: col.spreadsheetId, isDeleted: false } });
            const graph = buildGraph(cols.map(c => c.id === col.id ? { ...c.toJSON(), formulaExpr: req.body.formulaExpr } : c.toJSON()));
            checkCircular(graph, col.id);
        }
        await col.update(req.body);
        if (col.formulaExpr) await recalculateFormulas(col.spreadsheetId);
        await logAction(req.user.id, "column", col.id, "update", old, req.body, req, { spreadsheetId });
        const io = getIO();
        if (io) io.to(`sheet:${col.spreadsheetId}`).emit("column_updated", { action: "updated", sheetId: col.spreadsheetId, column: col.toJSON() });
        res.json({ data: col, message: "Column updated" });
    } catch (e) { next(e); }
};

export const deleteColumn = async (req, res, next) => {
    try {
        const { id: spreadsheetId, colId } = req.params;
        const col = await Column.findOne({ where: { id: colId, spreadsheetId, isDeleted: false } });
        if (!col) throw new AppError("Column not found", 404);
        await col.update({ isDeleted: true });
        await logAction(req.user.id, "column", col.id, "delete", null, null, req, { spreadsheetId });
        const io = getIO();
        if (io) io.to(`sheet:${col.spreadsheetId}`).emit("column_updated", { action: "deleted", sheetId: col.spreadsheetId, columnId: col.id });
        res.json({ message: "Column deleted" });
    } catch (e) { next(e); }
};

export const moveColumnLeft = async (req, res, next) => {
    try {
        const { id: spreadsheetId, colId } = req.params;
        const col = await Column.findOne({ where: { id: colId, spreadsheetId, isDeleted: false } });
        if (!col) throw new AppError("Column not found", 404);
        if (col.orderIndex === 0) throw new AppError("Column is already at the leftmost position", 400);
        const prev = await Column.findOne({ where: { spreadsheetId, orderIndex: col.orderIndex - 1, isDeleted: false } });
        if (!prev) throw new AppError("No column to the left", 400);
        await sequelize.transaction(async (t) => {
            await col.update({ orderIndex: prev.orderIndex }, { transaction: t });
            await prev.update({ orderIndex: col.orderIndex }, { transaction: t });
        });
        const io = getIO();
        if (io) io.to(`sheet:${spreadsheetId}`).emit("column_updated", { action: "reordered", sheetId: spreadsheetId });
        res.json({ message: "Column moved left" });
    } catch (e) { next(e); }
};

export const moveColumnRight = async (req, res, next) => {
    try {
        const { id: spreadsheetId, colId } = req.params;
        const col = await Column.findOne({ where: { id: colId, spreadsheetId, isDeleted: false } });
        if (!col) throw new AppError("Column not found", 404);
        const next_ = await Column.findOne({ where: { spreadsheetId, orderIndex: col.orderIndex + 1, isDeleted: false } });
        if (!next_) throw new AppError("No column to the right", 400);
        await sequelize.transaction(async (t) => {
            await col.update({ orderIndex: next_.orderIndex }, { transaction: t });
            await next_.update({ orderIndex: col.orderIndex }, { transaction: t });
        });
        const io = getIO();
        if (io) io.to(`sheet:${spreadsheetId}`).emit("column_updated", { action: "reordered", sheetId: spreadsheetId });
        res.json({ message: "Column moved right" });
    } catch (e) { next(e); }
};

export const reorderColumns = async (req, res, next) => {
    try {
        const { id: spreadsheetId } = req.params;
        const { columns } = req.body;
        if (!Array.isArray(columns)) throw new AppError("columns array required", 400);
        await sequelize.transaction(async (t) => {
            for (const { id, orderIndex } of columns) {
                await Column.update({ orderIndex }, { where: { id, spreadsheetId }, transaction: t });
            }
        });
        const io = getIO();
        if (io) io.to(`sheet:${spreadsheetId}`).emit("column_updated", { action: "reordered", sheetId: spreadsheetId });
        res.json({ message: "Columns reordered" });
    } catch (e) { next(e); }
};

// ── Export / Import ────────────────────────────────────────────────────────
export const exportSheet = async (req, res, next) => {
    try {
        const { id: spreadsheetId } = req.params;
        const sheet = await Spreadsheet.findOne({ where: { id: spreadsheetId } });
        if (!sheet) throw new AppError("Spreadsheet not found", 404);

        const columns = await Column.findAll({ where: { spreadsheetId } });
        const rows = await Row.findAll({ where: { spreadsheetId } });
        const cells = await Cell.findAll({ where: { rowId: rows.map(r => r.id) } });
        const permissions = await ColumnPermission.findAll({ where: { spreadsheetId } });

        const exportData = {
            sheet, columns, rows, cells, permissions
        };

        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", `attachment; filename=backup_${sheet.name.replace(/\s+/g, '_')}.json`);
        res.send(JSON.stringify(exportData, null, 2));

        await logAction(req.user.id, "sheet", spreadsheetId, "export", null, null, req);
    } catch (e) { next(e); }
};

export const importSheet = async (req, res, next) => {
    try {
        const { sheet, columns, rows, cells } = req.body;
        if (!sheet || !columns || !rows || !cells) throw new AppError("Invalid backup file format", 400);

        await sequelize.transaction(async (t) => {
            // Create new sheet
            const newSheet = await Spreadsheet.create({
                name: `${sheet.name} (Restored)`,
                createdBy: req.user.id,
                folderId: req.body.folderId || null,
                settings: sheet.settings,
                isLocked: sheet.isLocked
            }, { transaction: t });

            // Create columns and map old IDs to new IDs
            const colIdMap = {};
            for (const col of columns) {
                const newCol = await Column.create({
                    spreadsheetId: newSheet.id,
                    name: col.name,
                    type: col.type,
                    orderIndex: col.orderIndex,
                    width: col.width,
                    alignment: col.alignment,
                    currencyCode: col.currencyCode,
                    defaultValue: col.defaultValue,
                    isHidden: col.isHidden,
                    isProtected: col.isProtected,
                    formulaExpr: col.formulaExpr
                }, { transaction: t });
                colIdMap[col.id] = newCol.id;
            }

            // Create rows and map old IDs to new IDs
            const rowIdMap = {};
            for (const row of rows) {
                const newRow = await Row.create({
                    spreadsheetId: newSheet.id,
                    order: row.order,
                    rowColor: row.rowColor,
                    isLocked: row.isLocked
                }, { transaction: t });
                rowIdMap[row.id] = newRow.id;
            }

            // Reconstruct cells
            const newCells = cells.map(cell => ({
                rowId: rowIdMap[cell.rowId],
                columnId: colIdMap[cell.columnId],
                rawValue: cell.rawValue,
                computedValue: cell.computedValue,
                formattedValue: cell.formattedValue,
                isFormula: cell.isFormula,
                fileUrl: cell.fileUrl,
                bgColor: cell.bgColor,
                currencyCode: cell.currencyCode
            })).filter(c => c.rowId && c.columnId);

            if (newCells.length > 0) {
                await Cell.bulkCreate(newCells, { transaction: t });
            }

            await logAction(req.user.id, "sheet", newSheet.id, "create", null, null, req, { note: "Restored from backup" });

            res.status(201).json({ message: "Spreadsheet restored successfully", sheetId: newSheet.id });
        });
    } catch (e) { next(e); }
};

export const toggleColumnHidden = async (req, res, next) => {
    try {
        const { id: spreadsheetId, colId } = req.params;
        const col = await Column.findOne({ where: { id: colId, spreadsheetId, isDeleted: false } });
        if (!col) throw new AppError("Column not found", 404);
        await col.update({ isHidden: !col.isHidden });
        const io = getIO();
        if (io) io.to(`sheet:${spreadsheetId}`).emit("column_updated", { action: "visibility_changed", sheetId: spreadsheetId, columnId: col.id, isHidden: col.isHidden });
        res.json({ data: { isHidden: col.isHidden }, message: `Column ${col.isHidden ? "hidden" : "shown"}` });
    } catch (e) { next(e); }
};

export const toggleColumnLocked = async (req, res, next) => {
    try {
        const { id: spreadsheetId, colId } = req.params;
        const col = await Column.findOne({ where: { id: colId, spreadsheetId, isDeleted: false } });
        if (!col) throw new AppError("Column not found", 404);
        await col.update({ isLocked: !col.isLocked });
        res.json({ data: { isLocked: col.isLocked }, message: `Column ${col.isLocked ? "locked" : "unlocked"}` });
    } catch (e) { next(e); }
};
