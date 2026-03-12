import Spreadsheet from "./spreadsheet.model.js";
import Column from "./column.model.js";
import Row from "./row.model.js";
import Cell from "./cell.model.js";
import SheetPermission from "./permission.model.js";
import ColumnPermission from "./column_permission.model.js";
import { evaluate, resolveColumnNames } from "../../utils/formulaEngine.js";
import { parseCurrencyInput, formatCurrencyValue } from "../../utils/currencyHelpers.js";
import { buildGraph, checkCircular, topoSort } from "../../utils/dependencyGraph.js";
import { logAction } from "../../utils/auditLogger.js";
import AppError from "../../utils/AppError.js";
import { getPagination, getMeta } from "../../utils/pagination.js";
import { getIO } from "../../config/socket.js";
import { Op } from "sequelize";
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

        const sheet = await Spreadsheet.findOne({ where: { id: spreadsheetId, isDeleted: false } });
        if (!sheet) throw new AppError("Spreadsheet not found", 404);

        let columns = await Column.findAll({
            where: { spreadsheetId, isDeleted: false, isHidden: false },
            order: [["orderIndex", "ASC"]]
        });

        // Column privacy filtering for staff
        if (role === "staff") {
            const colPerm = await ColumnPermission.findOne({ where: { userId, sheetId: spreadsheetId } });
            if (colPerm && colPerm.allowedColumnIds?.length) {
                columns = columns.filter(c => colPerm.allowedColumnIds.includes(c.id));
            }
        }

        const { count: totalRows, rows } = await Row.findAndCountAll({
            where: { spreadsheetId, isDeleted: false },
            order: [["order", "ASC"]],
            limit,
            offset
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
            data: { sheet, columns, grid },
            meta: getMeta(page, limit, totalRows)
        });
    } catch (e) { next(e); }
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
        const col = await Column.findByPk(cell.columnId);
        
        let finalRaw = rawValue;
        let finalFormatted = formattedValue ?? rawValue;
        if (col.type === "currency") {
            finalRaw = parseCurrencyInput(rawValue);
            finalFormatted = formatCurrencyValue(parseFloat(finalRaw), currencyCode || cell.currencyCode || col.currencyCode);
        }

        if (col?.validationRules) validateCellValue(finalRaw, col);

        await cell.update({ rawValue: finalRaw, formattedValue: finalFormatted, computedValue: finalRaw, fileUrl, currencyCode: currencyCode !== undefined ? currencyCode : cell.currencyCode, updatedBy: req.user.id });

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

        const col = await Column.findByPk(columnId);
        
        let finalRaw = rawValue;
        let finalFormatted = formattedValue ?? rawValue;
        if (col.type === "currency") {
            finalRaw = parseCurrencyInput(rawValue);
            finalFormatted = formatCurrencyValue(parseFloat(finalRaw), currencyCode || col.currencyCode);
        }

        if (col?.validationRules) validateCellValue(finalRaw, col);

        const [cell] = await Cell.upsert(
            { rowId, columnId, rawValue: finalRaw, formattedValue: finalFormatted, computedValue: finalRaw, currencyCode, fileUrl, updatedBy: req.user.id },
            { returning: true }
        );

        const updatedCells = await recalculateFormulas(spreadsheetId);
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

export async function recalculateFormulas(spreadsheetId) {
    const columns = await Column.findAll({ where: { spreadsheetId, isDeleted: false }, order: [["orderIndex", "ASC"]] });
    const formulaCols = columns.filter(c => c.type === "formula" && c.formulaExpr);
    if (!formulaCols.length) return [];

    const graph = buildGraph(columns.map(c => c.toJSON()));
    const order = topoSort(graph);
    const rows = await Row.findAll({ where: { spreadsheetId, isDeleted: false }, order: [["order", "ASC"]] });

    // Build column-letter mapping once
    const colLetterMap = {};  // colId → letter
    const colInfoForResolve = []; // [{name, colLetter}] for resolveColumnNames
    columns.forEach((col, i) => {
        const letter = indexToLetter(i);
        colLetterMap[col.id] = letter;
        colInfoForResolve.push({ name: col.name, colLetter: letter });
    });

    // Build rowIndex mapping
    const rowIndexMap = {};
    rows.forEach((row, i) => { rowIndexMap[row.id] = i + 1; });

    // Build cellMap once (will be updated as we compute formulas)
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

    for (const row of rows) {
        const rowNum = rowIndexMap[row.id];
        for (const colId of order) {
            const col = formulaCols.find(c => c.id === colId);
            if (!col) continue;
            try {
                // Convert column names in formula to A1-refs for this specific row
                const resolvedFormula = resolveColumnNames(col.formulaExpr, colInfoForResolve, rowNum);

                const computed = evaluate(resolvedFormula, cellMap);
                const currencyCodePayload = col.currencyCode ? { currencyCode: col.currencyCode } : {};
                
                const [updatedCell] = await Cell.upsert({
                    rowId: row.id,
                    columnId: col.id,
                    rawValue: col.formulaExpr,
                    computedValue: String(computed ?? ""),
                    updatedBy: null,
                    ...currencyCodePayload
                }, { returning: true });

                // Update cellMap so dependent formulas in the same row can use this result
                const colLetter = colLetterMap[col.id];
                if (colLetter) {
                    cellMap[`${colLetter}${rowNum}`] = String(computed ?? "");
                }

                updatedCells.push({
                    cellId: Array.isArray(updatedCell) ? updatedCell[0]?.id : updatedCell?.id,
                    columnId: col.id,
                    rowId: row.id,
                    computedValue: String(computed ?? "")
                });
            } catch (err) {
                await Cell.upsert({
                    rowId: row.id, columnId: col.id,
                    rawValue: col.formulaExpr, computedValue: `#ERR: ${err.message}`
                });
            }
        }
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
