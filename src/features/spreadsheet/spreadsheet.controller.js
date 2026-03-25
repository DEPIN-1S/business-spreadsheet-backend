import Spreadsheet from "./spreadsheet.model.js";
import Column from "./column.model.js";
import Row from "./row.model.js";
import Cell from "./cell.model.js";
import SheetPermission from "./permission.model.js";
import ColumnPermission from "./column_permission.model.js";
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
            const colPerm = await ColumnPermission.findOne({ where: { userId, spreadsheetId } });
            if (colPerm && colPerm.columnAccess) {
                columnPermissionsMap = typeof colPerm.columnAccess === 'string' 
                    ? JSON.parse(colPerm.columnAccess) 
                    : colPerm.columnAccess;
                // Filter columns to only those explicitly granted 'view' or 'edit'
                columns = columns.filter(c => columnPermissionsMap[c.id]);
            } else {
                // If no ColumnPermission record, staff can see nothing (secure by default)
                // Actually, if we want "all columns" by default if shared generally, we should check SheetPermission.
                // For now, let's stick to the user's intent: sharing specific columns.
                columns = [];
            }
        } else {
            // Admin/SuperAdmin see all and can edit all
            columns.forEach(c => { columnPermissionsMap[c.id] = 'edit'; });
        }

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
            isLocked: row.isLocked,
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
        const { rawValue, formattedValue, fileUrl, currencyCode } = req.body;

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
        if (col.type === "currency") {
            finalRaw = parseCurrencyInput(rawValue);
            finalFormatted = formatCurrencyValue(parseFloat(finalRaw), currencyCode || cell.currencyCode || col.currencyCode);
        } else if (col.type === "date" && rawValue) {
            const d = new Date(rawValue);
            if (!isNaN(d.getTime())) {
                finalRaw = d.toISOString().slice(0, 10);
                finalFormatted = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
            }
        }

        if (col?.validationRules) validateCellValue(finalRaw, col);

        await cell.update({ rawValue: finalRaw, formattedValue: finalFormatted, computedValue: finalRaw, fileUrl, currencyCode: currencyCode !== undefined ? currencyCode : cell.currencyCode, updatedBy: req.user.id });

        const updatedCells = await recalculateFormulas(spreadsheetId, cell.rowId);
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
        const { rowId, columnId, rawValue, fileUrl, formattedValue, currencyCode } = req.body;
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
        if (col.type === "currency") {
            finalRaw = parseCurrencyInput(rawValue);
            finalFormatted = formatCurrencyValue(parseFloat(finalRaw), currencyCode || col.currencyCode);
        } else if (col.type === "date" && rawValue) {
            const d = new Date(rawValue);
            if (!isNaN(d.getTime())) {
                finalRaw = d.toISOString().slice(0, 10);
                finalFormatted = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
            }
        }

        if (col?.validationRules) validateCellValue(finalRaw, col);

        const [cell] = await Cell.upsert(
            { rowId, columnId, rawValue: finalRaw, formattedValue: finalFormatted, computedValue: finalRaw, currencyCode, fileUrl, updatedBy: req.user.id },
            { returning: true }
        );

        const updatedCells = await recalculateFormulas(spreadsheetId, rowId);
        const cellResult = Array.isArray(cell) ? cell[0] : cell;

        const io = getIO();
        if (io) {
            io.to(`sheet:${spreadsheetId}`).emit("cell_updated", {
                sheetId: spreadsheetId,
                cellId: cellResult.id,
                columnId, rowId, rawValue,
                computedValue: cellResult.computedValue,
                updatedBy: req.user.id,
                at: new Date().toISOString()
            });
            if (updatedCells.length) {
                io.to(`sheet:${spreadsheetId}`).emit("formula_recalculated", { sheetId: spreadsheetId, cells: updatedCells });
            }
        }

        res.json({ data: cellResult, message: "Cell saved" });
    } catch (e) { next(e); }
};

export async function recalculateFormulas(spreadsheetId, targetRowId = null) {
    const columns = await Column.findAll({ where: { spreadsheetId, isDeleted: false }, order: [["orderIndex", "ASC"]] });
    const formulaCols = columns.filter(c => c.type === "formula" && c.formulaExpr);
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
    const allCells = rows.length && columns.length
        ? await Cell.findAll({ where: { rowId: rows.map(r => r.id), columnId: columns.map(c => c.id) } })
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
        const { rowColor, height } = req.body;
        const count = await Row.count({ where: { spreadsheetId, isDeleted: false } });
        const row = await Row.create({ spreadsheetId, order: count, rowColor, height });

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
        const { rowColor } = req.body;

        const row = await Row.findByPk(rowId);
        if (!row) throw new AppError("Row not found", 404);
        await row.update({ rowColor: rowColor || null });

        const io = getIO();
        if (io) io.to(`sheet:${spreadsheetId}`).emit("row_updated", { action: "color_changed", sheetId: spreadsheetId, rowId, rowColor });

        res.json({ data: row, message: "Row color updated" });
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

        let whereSpreadsheet = { isDeleted: false };
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
            include: [{ model: User, as: "creator", attributes: ["id", "name", "email", "avatar"] }]
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
        const { email, role = "viewer", columnAccess } = req.body;
        logger.info(`[DEBUG] shareSheet: sheetId=${spreadsheetId}, email=${email}, role=${role}, hasColumnAccess=${columnAccess !== undefined}`);

        const sheet = await Spreadsheet.findOne({ where: { id: spreadsheetId, isDeleted: false } });
        if (!sheet) throw new AppError("Spreadsheet not found", 404);

        const user = await User.findOne({ where: { email } });
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
        const { name, description, folderId, settings } = req.body;
        if (folderId) {
            const folder = await Folder.findOne({ where: { id: folderId, isDeleted: false } });
            if (!folder) throw new AppError("Folder not found", 404);
        }
        let sheet;
        await sequelize.transaction(async (t) => {
            sheet = await Spreadsheet.create({ name, description, folderId: folderId || null, settings, createdBy: req.user.id }, { transaction: t });
            const defaultColumns = [
                { spreadsheetId: sheet.id, name: "Column 1", type: "text", orderIndex: 0 },
                { spreadsheetId: sheet.id, name: "Column 2", type: "text", orderIndex: 1 },
                { spreadsheetId: sheet.id, name: "Column 3", type: "text", orderIndex: 2 },
            ];
            await Column.bulkCreate(defaultColumns, { transaction: t });
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

export const duplicateSheet = async (req, res, next) => {
    try {
        const original = await Spreadsheet.findOne({ where: { id: req.params.id, isDeleted: false } });
        if (!original) throw new AppError("Spreadsheet not found", 404);
        let newSheet;
        await sequelize.transaction(async (t) => {
            newSheet = await Spreadsheet.create({ name: `${original.name} (Copy)`, description: original.description, folderId: original.folderId, settings: original.settings, createdBy: req.user.id }, { transaction: t });
            const columns = await Column.findAll({ where: { spreadsheetId: original.id, isDeleted: false }, order: [["orderIndex", "ASC"]] });
            const columnMap = {};
            for (const col of columns) {
                const newCol = await Column.create({ spreadsheetId: newSheet.id, name: col.name, type: col.type, orderIndex: col.orderIndex, defaultValue: col.defaultValue, alignment: col.alignment, width: col.width, textColor: col.textColor, bgColor: col.bgColor, options: col.options, validationRules: col.validationRules, formulaExpr: col.formulaExpr, currencyCode: col.currencyCode }, { transaction: t });
                columnMap[col.id] = newCol;
            }
            const rows = await Row.findAll({ where: { spreadsheetId: original.id, isDeleted: false }, order: [["order", "ASC"]] });
            for (const row of rows) {
                const newRow = await Row.create({ spreadsheetId: newSheet.id, order: row.order, rowColor: row.rowColor, height: row.height }, { transaction: t });
                const cells = await Cell.findAll({ where: { rowId: row.id } });
                const newCells = cells.map(cell => ({ rowId: newRow.id, columnId: columnMap[cell.columnId]?.id, rawValue: cell.rawValue, formattedValue: cell.formattedValue, computedValue: cell.computedValue, currencyCode: cell.currencyCode, fileUrl: cell.fileUrl, updatedBy: req.user.id })).filter(c => c.columnId);
                if (newCells.length) await Cell.bulkCreate(newCells, { transaction: t });
            }
        });
        await logAction(req.user.id, "sheet", newSheet.id, "create", null, { duplicatedFrom: req.params.id }, req, { spreadsheetId: newSheet.id });
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
