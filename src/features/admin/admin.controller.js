import Spreadsheet from "../spreadsheet/spreadsheet.model.js";
import Column from "../spreadsheet/column.model.js";
import Row from "../spreadsheet/row.model.js";
import Cell from "../spreadsheet/cell.model.js";
import SheetPermission from "../spreadsheet/permission.model.js";
import User from "../user/user.model.js";
import AuditLog from "../audit/auditlog.model.js";
import { getPagination, getMeta } from "../../utils/pagination.js";
import { logAction } from "../../utils/auditLogger.js";
import AppError from "../../utils/AppError.js";
import { buildGraph, checkCircular } from "../../utils/dependencyGraph.js";

// ── Spreadsheet CRUD ─────────────────────────────────────────────────────────

export const createSheet = async (req, res, next) => {
  try {
    const sheet = await Spreadsheet.create({ ...req.body, createdBy: req.user.id });
    await logAction(req.user.id, "sheet", sheet.id, "create", null, req.body, req);
    res.status(201).json({ data: sheet, message: "Spreadsheet created" });
  } catch (e) { next(e); }
};

export const listSheets = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const { rows, count } = await Spreadsheet.findAndCountAll({
      where: { isDeleted: false },
      limit, offset,
      order: [["createdAt", "DESC"]],
      include: [{ model: User, as: "creator", attributes: ["id", "name", "email"] }]
    });
    res.json({ data: rows, meta: getMeta(page, limit, count) });
  } catch (e) { next(e); }
};

export const getSheet = async (req, res, next) => {
  try {
    const sheet = await Spreadsheet.findOne({ where: { id: req.params.id, isDeleted: false } });
    if (!sheet) throw new AppError("Spreadsheet not found", 404);
    res.json({ data: sheet });
  } catch (e) { next(e); }
};

export const updateSheet = async (req, res, next) => {
  try {
    const sheet = await Spreadsheet.findOne({ where: { id: req.params.id, isDeleted: false } });
    if (!sheet) throw new AppError("Spreadsheet not found", 404);
    const old = { name: sheet.name, description: sheet.description };
    await sheet.update(req.body);
    await logAction(req.user.id, "sheet", sheet.id, "update", old, req.body, req);
    res.json({ data: sheet, message: "Spreadsheet updated" });
  } catch (e) { next(e); }
};

export const deleteSheet = async (req, res, next) => {
  try {
    const sheet = await Spreadsheet.findOne({ where: { id: req.params.id, isDeleted: false } });
    if (!sheet) throw new AppError("Spreadsheet not found", 404);
    await sheet.update({ isDeleted: true });
    await logAction(req.user.id, "sheet", sheet.id, "delete", null, null, req);
    res.json({ message: "Spreadsheet deleted" });
  } catch (e) { next(e); }
};

// ── Column management ────────────────────────────────────────────────────────

export const addColumn = async (req, res, next) => {
  try {
    const { id: spreadsheetId } = req.params;
    // Validate formula for circular deps
    if (req.body.formulaExpr) {
      const cols = await Column.findAll({ where: { spreadsheetId, isDeleted: false } });
      const graph = buildGraph([...cols, { id: "NEW", name: req.body.name, formulaExpr: req.body.formulaExpr }]);
      checkCircular(graph, "NEW");
    }
    const col = await Column.create({ ...req.body, spreadsheetId });
    await logAction(req.user.id, "column", col.id, "create", null, req.body, req);
    res.status(201).json({ data: col, message: "Column added" });
  } catch (e) { next(e); }
};

export const updateColumn = async (req, res, next) => {
  try {
    const col = await Column.findByPk(req.params.colId);
    if (!col) throw new AppError("Column not found", 404);
    const old = col.toJSON();
    if (req.body.formulaExpr) {
      const cols = await Column.findAll({ where: { spreadsheetId: col.spreadsheetId, isDeleted: false } });
      const graph = buildGraph(cols.map(c => c.id === col.id ? { ...c.toJSON(), formulaExpr: req.body.formulaExpr } : c.toJSON()));
      checkCircular(graph, col.id);
    }
    await col.update(req.body);
    await logAction(req.user.id, "column", col.id, "update", old, req.body, req);
    res.json({ data: col, message: "Column updated" });
  } catch (e) { next(e); }
};

export const deleteColumn = async (req, res, next) => {
  try {
    const col = await Column.findByPk(req.params.colId);
    if (!col) throw new AppError("Column not found", 404);
    await col.update({ isDeleted: true });
    await logAction(req.user.id, "column", col.id, "delete", null, null, req);
    res.json({ message: "Column deleted" });
  } catch (e) { next(e); }
};

// ── Permission management ────────────────────────────────────────────────────

export const setPermission = async (req, res, next) => {
  try {
    const { id: spreadsheetId } = req.params;
    const { userId, canView, canEdit, canEditFormulas, restrictedColumns } = req.body;
    const [perm, created] = await SheetPermission.upsert({ userId, spreadsheetId, canView, canEdit, canEditFormulas, restrictedColumns }, { returning: true });
    await logAction(req.user.id, "permission", perm[0]?.id || perm.id, created ? "create" : "update", null, req.body, req);
    res.status(created ? 201 : 200).json({ data: perm, message: "Permission set" });
  } catch (e) { next(e); }
};

export const listPermissions = async (req, res, next) => {
  try {
    const perms = await SheetPermission.findAll({
      where: { spreadsheetId: req.params.id },
      include: [{ model: User, attributes: ["id", "name", "email", "role"] }]
    });
    res.json({ data: perms });
  } catch (e) { next(e); }
};

// ── Audit log access ─────────────────────────────────────────────────────────

export const getAuditForSheet = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const { rows, count } = await AuditLog.findAndCountAll({
      where: { entity: "cell", entityId: { [Symbol.for("like")]: `%${req.params.id}%` } },
      limit, offset,
      order: [["createdAt", "DESC"]]
    });
    res.json({ data: rows, meta: getMeta(page, limit, count) });
  } catch (e) { next(e); }
};
