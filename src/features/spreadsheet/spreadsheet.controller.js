import Spreadsheet from "./spreadsheet.model.js";
import Column from "./column.model.js";
import Row from "./row.model.js";
import Cell from "./cell.model.js";
import SheetPermission from "./permission.model.js";
import { evaluate } from "../../utils/formulaEngine.js";
import { buildGraph, checkCircular, topoSort } from "../../utils/dependencyGraph.js";
import { logAction } from "../../utils/auditLogger.js";
import AppError from "../../utils/AppError.js";
import { getPagination, getMeta } from "../../utils/pagination.js";
import { Op } from "sequelize";

// ── Helper: build cellMap { "ColName_RowIdx": value } for formula engine ────
async function buildCellMap(spreadsheetId) {
    const columns = await Column.findAll({ where: { spreadsheetId, isDeleted: false }, order: [["order", "ASC"]] });
    const rows = await Row.findAll({ where: { spreadsheetId, isDeleted: false }, order: [["order", "ASC"]] });
    const cells = await Cell.findAll({
        where: { rowId: rows.map(r => r.id), columnId: columns.map(c => c.id) }
    });

    const colIndexMap = {}; // columnId → letter (A, B, C...)
    columns.forEach((col, i) => {
        colIndexMap[col.id] = indexToLetter(i);
    });
    const rowIndexMap = {}; // rowId → 1-based number
    rows.forEach((row, i) => {
        rowIndexMap[row.id] = i + 1;
    });

    const cellMap = {};
    cells.forEach(cell => {
        const colLetter = colIndexMap[cell.columnId];
        const rowNum = rowIndexMap[cell.rowId];
        if (colLetter && rowNum) {
            const key = `${colLetter}${rowNum}`;
            cellMap[key] = cell.computedValue ?? cell.rawValue ?? "";
        }
    });

    return { cellMap, columns, rows, cells, colIndexMap, rowIndexMap };
}

function indexToLetter(idx) {
    // Convert 0-based index to Excel-style column letter: 0→A, 25→Z, 26→AA
    let letter = "";
    let n = idx;
    do {
        letter = String.fromCharCode(65 + (n % 26)) + letter;
        n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return letter;
}

// ── Get full sheet grid ──────────────────────────────────────────────────────
export const getSheetData = async (req, res, next) => {
    try {
        const { id: spreadsheetId } = req.params;
        const sheet = await Spreadsheet.findOne({ where: { id: spreadsheetId, isDeleted: false } });
        if (!sheet) throw new AppError("Spreadsheet not found", 404);

        const columns = await Column.findAll({ where: { spreadsheetId, isDeleted: false }, order: [["order", "ASC"]] });
        const rows = await Row.findAll({ where: { spreadsheetId, isDeleted: false }, order: [["order", "ASC"]] });
        const rowIds = rows.map(r => r.id);
        const colIds = columns.map(c => c.id);

        const cells = rowIds.length && colIds.length
            ? await Cell.findAll({ where: { rowId: rowIds, columnId: colIds } })
            : [];

        // Build grid: rows × columns
        const cellIdx = {};
        cells.forEach(c => { cellIdx[`${c.rowId}_${c.columnId}`] = c; });

        const grid = rows.map((row, ri) => ({
            id: row.id,
            order: row.order,
            cells: columns.map((col, ci) => {
                const cell = cellIdx[`${row.id}_${col.id}`];
                return {
                    id: cell?.id || null,
                    columnId: col.id,
                    columnName: col.name,
                    columnType: col.type,
                    rawValue: cell?.rawValue ?? null,
                    computedValue: cell?.computedValue ?? null,
                    fileUrl: cell?.fileUrl ?? null,
                    ref: `${indexToLetter(ci)}${ri + 1}`
                };
            })
        }));

        // Filter columns based on staff restricted columns
        const { role, id: userId } = req.user;
        let restrictedCols = [];
        if (role === "staff") {
            const perm = await SheetPermission.findOne({ where: { userId, spreadsheetId } });
            restrictedCols = perm?.restrictedColumns || [];
        }

        const filteredColumns = role === "staff"
            ? columns.filter(c => !restrictedCols.includes(c.id))
            : columns;

        res.json({ data: { sheet, columns: filteredColumns, grid } });
    } catch (e) { next(e); }
};

// ── Update a cell (triggers formula recalculation) ───────────────────────────
export const updateCell = async (req, res, next) => {
    try {
        const { id: spreadsheetId, cellId } = req.params;
        const { rawValue } = req.body;

        // Check edit permission for staff
        if (req.user.role === "staff") {
            const perm = await SheetPermission.findOne({ where: { userId: req.user.id, spreadsheetId } });
            if (!perm || !perm.canEdit) throw new AppError("Edit access denied", 403);
        }

        let cell = await Cell.findByPk(cellId);
        if (!cell) throw new AppError("Cell not found", 404);

        const oldValue = cell.rawValue;
        const col = await Column.findByPk(cell.columnId);

        // Column-level validation
        if (col?.validationRules) {
            validateCellValue(rawValue, col);
        }

        await cell.update({ rawValue, computedValue: rawValue, updatedBy: req.user.id });

        // Recalculate all formula columns in this sheet
        await recalculateFormulas(spreadsheetId);

        // Re-fetch updated cell
        cell = await Cell.findByPk(cellId);

        await logAction(req.user.id, "cell", cellId, "update",
            { rawValue: oldValue },
            { rawValue, computedValue: cell.computedValue },
            req, { spreadsheetId }
        );

        res.json({ data: cell, message: "Cell updated" });
    } catch (e) { next(e); }
};

// ── Formula recalculation engine ─────────────────────────────────────────────
async function recalculateFormulas(spreadsheetId) {
    const columns = await Column.findAll({ where: { spreadsheetId, isDeleted: false }, order: [["order", "ASC"]] });
    const formulaCols = columns.filter(c => c.type === "formula" && c.formulaExpr);
    if (!formulaCols.length) return;

    // Build dependency graph and get evaluation order
    const graph = buildGraph(columns.map(c => c.toJSON()));
    const order = topoSort(graph); // resolve order

    const rows = await Row.findAll({ where: { spreadsheetId, isDeleted: false }, order: [["order", "ASC"]] });

    // Recalculate for each row
    for (const row of rows) {
        const { cellMap } = await buildCellMap(spreadsheetId);
        for (const colId of order) {
            const col = formulaCols.find(c => c.id === colId);
            if (!col) continue;
            try {
                const computed = evaluate(col.formulaExpr, cellMap);
                const [updatedCell] = await Cell.upsert({
                    rowId: row.id,
                    columnId: col.id,
                    rawValue: col.formulaExpr,
                    computedValue: String(computed ?? ""),
                    updatedBy: null
                }, { returning: true });
                // Update cellMap with new computed value
                const colIdx = columns.findIndex(c => c.id === col.id);
                const rowIdx = rows.findIndex(r => r.id === row.id);
                if (colIdx >= 0 && rowIdx >= 0) {
                    cellMap[`${indexToLetter(colIdx)}${rowIdx + 1}`] = String(computed ?? "");
                }
            } catch (err) {
                // Formula error — store error message as computed value
                await Cell.upsert({
                    rowId: row.id,
                    columnId: col.id,
                    rawValue: col.formulaExpr,
                    computedValue: `#ERR: ${err.message}`
                });
            }
        }
    }
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
    if (col.type === "date" && value) {
        if (isNaN(Date.parse(value))) throw new AppError(`Column "${col.name}" must be a valid date`, 422);
    }
}

// ── Row management ────────────────────────────────────────────────────────────
export const addRow = async (req, res, next) => {
    try {
        const { id: spreadsheetId } = req.params;
        const count = await Row.count({ where: { spreadsheetId, isDeleted: false } });
        const row = await Row.create({ spreadsheetId, order: count });
        await logAction(req.user.id, "row", row.id, "create", null, { spreadsheetId }, req);
        res.status(201).json({ data: row, message: "Row added" });
    } catch (e) { next(e); }
};

export const deleteRow = async (req, res, next) => {
    try {
        const row = await Row.findByPk(req.params.rowId);
        if (!row) throw new AppError("Row not found", 404);
        await row.update({ isDeleted: true });
        await logAction(req.user.id, "row", row.id, "delete", null, null, req);
        res.json({ message: "Row deleted" });
    } catch (e) { next(e); }
};

// ── Upsert cell (create if not exists) ────────────────────────────────────────
export const upsertCell = async (req, res, next) => {
    try {
        const { rowId, columnId, rawValue, fileUrl } = req.body;
        const { id: spreadsheetId } = req.params;

        const col = await Column.findByPk(columnId);
        if (col?.validationRules) validateCellValue(rawValue, col);

        const [cell] = await Cell.upsert({ rowId, columnId, rawValue, computedValue: rawValue, fileUrl, updatedBy: req.user.id }, { returning: true });
        await recalculateFormulas(spreadsheetId);
        res.json({ data: Array.isArray(cell) ? cell[0] : cell, message: "Cell saved" });
    } catch (e) { next(e); }
};
