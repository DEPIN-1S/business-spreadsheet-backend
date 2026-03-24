import Spreadsheet from "../spreadsheet/spreadsheet.model.js";
import Column from "../spreadsheet/column.model.js";
import Row from "../spreadsheet/row.model.js";
import Cell from "../spreadsheet/cell.model.js";
import SheetPermission from "../spreadsheet/permission.model.js";
import ColumnPermission from "../spreadsheet/column_permission.model.js";
import Folder from "../spreadsheet/folder.model.js";
import User from "../user/user.model.js";
import AuditLog from "../audit/auditlog.model.js";
import { getPagination, getMeta } from "../../utils/pagination.js";
import { logAction } from "../../utils/auditLogger.js";
import AppError from "../../utils/AppError.js";
import { buildGraph, checkCircular } from "../../utils/dependencyGraph.js";
import { getIO } from "../../config/socket.js";
import sequelize from "../../config/db.js";
import { Op } from "sequelize";

// ── Spreadsheet CRUD ──────────────────────────────────────────────────────────

export const createSheet = async (req, res, next) => {
  try {
    const { name, description, folderId, settings } = req.body;
    if (folderId) {
      const folder = await Folder.findOne({ where: { id: folderId, isDeleted: false } });
      if (!folder) throw new AppError("Folder not found", 404);
    }

    let sheet;
    await sequelize.transaction(async (t) => {
      // 1. Create the spreadsheet
      sheet = await Spreadsheet.create(
        { name, description, folderId: folderId || null, settings, createdBy: req.user.id },
        { transaction: t }
      );

      // 2. Auto-create 3 default columns
      const defaultColumns = [
        { spreadsheetId: sheet.id, name: "Column 1", type: "text", orderIndex: 0 },
        { spreadsheetId: sheet.id, name: "Column 2", type: "text", orderIndex: 1 },
        { spreadsheetId: sheet.id, name: "Column 3", type: "text", orderIndex: 2 },
      ];
      await Column.bulkCreate(defaultColumns, { transaction: t });

      // 3. Auto-create 10 empty rows
      const defaultRows = Array.from({ length: 10 }, (_, i) => ({
        spreadsheetId: sheet.id,
        order: i,
      }));
      await Row.bulkCreate(defaultRows, { transaction: t });
    });

    await logAction(req.user.id, "sheet", sheet.id, "create", null, { name, folderId }, req);
    res.status(201).json({ data: sheet, message: "Spreadsheet created" });
  } catch (e) { next(e); }
};

export const listSheets = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const where = { isDeleted: false };
    if (req.query.folderId) where.folderId = req.query.folderId;
    const { rows, count } = await Spreadsheet.findAndCountAll({
      where, limit, offset,
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
    await logAction(req.user.id, "sheet", sheet.id, "update", old, req.body, req);

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
    await logAction(req.user.id, "sheet", sheet.id, "delete", null, null, req);
    res.json({ message: "Spreadsheet deleted" });
  } catch (e) { next(e); }
};

// ── Duplicate Sheet ───────────────────────────────────────────────────────────
export const duplicateSheet = async (req, res, next) => {
  try {
    const original = await Spreadsheet.findOne({ where: { id: req.params.id, isDeleted: false } });
    if (!original) throw new AppError("Spreadsheet not found", 404);

    let newSheet;
    await sequelize.transaction(async (t) => {
      newSheet = await Spreadsheet.create({
        name: `${original.name} (Copy)`,
        description: original.description,
        folderId: original.folderId,
        settings: original.settings,
        createdBy: req.user.id
      }, { transaction: t });

      const columns = await Column.findAll({ where: { spreadsheetId: original.id, isDeleted: false }, order: [["orderIndex", "ASC"]] });
      const columnMap = {}; // old id → new column
      for (const col of columns) {
        const newCol = await Column.create({
          spreadsheetId: newSheet.id,
          name: col.name, type: col.type, orderIndex: col.orderIndex,
          defaultValue: col.defaultValue, alignment: col.alignment, width: col.width,
          textColor: col.textColor, bgColor: col.bgColor,
          options: col.options, validationRules: col.validationRules,
          formulaExpr: col.formulaExpr, currencyCode: col.currencyCode
        }, { transaction: t });
        columnMap[col.id] = newCol;
      }

      const rows = await Row.findAll({ where: { spreadsheetId: original.id, isDeleted: false }, order: [["order", "ASC"]] });
      for (const row of rows) {
        const newRow = await Row.create({
          spreadsheetId: newSheet.id, order: row.order,
          rowColor: row.rowColor, height: row.height
        }, { transaction: t });

        const cells = await Cell.findAll({ where: { rowId: row.id } });
        const newCells = cells.map(cell => ({
          rowId: newRow.id,
          columnId: columnMap[cell.columnId]?.id,
          rawValue: cell.rawValue,
          formattedValue: cell.formattedValue,
          computedValue: cell.computedValue,
          currencyCode: cell.currencyCode,
          fileUrl: cell.fileUrl,
          updatedBy: req.user.id
        })).filter(c => c.columnId);
        if (newCells.length) await Cell.bulkCreate(newCells, { transaction: t });
      }
    });

    await logAction(req.user.id, "sheet", newSheet.id, "create", null, { duplicatedFrom: req.params.id }, req);
    res.status(201).json({ data: newSheet, message: "Sheet duplicated" });
  } catch (e) { next(e); }
};

// ── Share Sheet (SheetPermission + ColumnPermission) ─────────────────────────
export const shareSheet = async (req, res, next) => {
  try {
    const { id: spreadsheetId } = req.params;
    const { email, role = "viewer", columnAccess } = req.body;

    const sheet = await Spreadsheet.findOne({ where: { id: spreadsheetId, isDeleted: false } });
    if (!sheet) throw new AppError("Spreadsheet not found", 404);

    const user = await User.findOne({ where: { email } });
    if (!user) throw new AppError("User not found", 404);

    const canView = true;
    const canEdit = role === "editor" || role === "admin";
    const canEditFormulas = role === "admin";

    // Upsert sheet-level permission
    const [perm, created] = await SheetPermission.upsert(
      { userId: user.id, spreadsheetId, role, canView, canEdit, canEditFormulas, restrictedColumns: [], invitedBy: req.user.id },
      { returning: true }
    );
    
    // Upsert column-level permissions if specified
    if (columnAccess !== undefined) {
      await ColumnPermission.upsert({ userId: user.id, sheetId: spreadsheetId, columnAccess });
    }

    await logAction(req.user.id, "permission", spreadsheetId, created ? "create" : "update", null,
      { userId: user.id, role, canView, canEdit, columnAccess }, req);

    res.status(created ? 201 : 200).json({ data: Array.isArray(perm) ? perm[0] : perm, message: "Sheet shared" });
  } catch (e) { next(e); }
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
    await logAction(req.user.id, "permission", spreadsheetId, "update_role", { oldRole: perm.role }, { userId, role }, req);
    
    res.json({ message: "Share role updated", data: perm });
  } catch (e) { next(e); }
};

export const removeShare = async (req, res, next) => {
  try {
    const { id: spreadsheetId, userId } = req.params;
    const perm = await SheetPermission.findOne({ where: { spreadsheetId, userId } });
    if (!perm) throw new AppError("Permission not found", 404);
    
    await perm.destroy();
    
    // Also remove column permissions
    await ColumnPermission.destroy({ where: { sheetId: spreadsheetId, userId } });
    
    await logAction(req.user.id, "permission", spreadsheetId, "delete", perm.toJSON(), null, req);
    
    res.json({ message: "Access removed" });
  } catch (e) { next(e); }
};

export const getSharedWithMe = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    
    const perms = await SheetPermission.findAll({
      where: { userId: req.user.id },
      attributes: ["spreadsheetId", "role", "invitedBy"]
    });
    
    const sheetIds = perms.map(p => p.spreadsheetId);
    
    const { rows, count } = await Spreadsheet.findAndCountAll({
      where: { id: sheetIds, isDeleted: false },
      limit, offset,
      order: [["createdAt", "DESC"]],
      include: [{ model: User, as: "creator", attributes: ["id", "name", "email", "avatar"] }]
    });

    const sheetsWithRoles = rows.map(sheet => {
      const p = perms.find(perm => perm.spreadsheetId === sheet.id);
      return {
        ...sheet.toJSON(),
        permissionRole: p ? p.role : "viewer",
        invitedBy: p ? p.invitedBy : null
      };
    });
    
    res.json({ data: sheetsWithRoles, meta: getMeta(page, limit, count) });
  } catch (e) { next(e); }
};

// ── Column management ─────────────────────────────────────────────────────────

export const addColumn = async (req, res, next) => {
  try {
    const { id: spreadsheetId } = req.params;
    if (req.body.formulaExpr) {
      const cols = await Column.findAll({ where: { spreadsheetId, isDeleted: false } });
      const graph = buildGraph([...cols.map(c => c.toJSON()), { id: "NEW", name: req.body.name, formulaExpr: req.body.formulaExpr }]);
      checkCircular(graph, "NEW");
    }
    // Auto-assign orderIndex if not provided
    if (req.body.orderIndex === undefined) {
      const maxOrder = await Column.max("orderIndex", { where: { spreadsheetId, isDeleted: false } });
      req.body.orderIndex = (maxOrder ?? -1) + 1;
    } else {
      // Shift existing columns at or after this position to make room
      await Column.increment("orderIndex", {
        by: 1,
        where: {
          spreadsheetId,
          isDeleted: false,
          orderIndex: { [Op.gte]: req.body.orderIndex }
        }
      });
    }
    const col = await Column.create({ ...req.body, spreadsheetId });

    // Trigger formula recalculation if new column has a formula
    if (col.formulaExpr) {
      const { recalculateFormulas } = await import("../spreadsheet/spreadsheet.controller.js");
      await recalculateFormulas(spreadsheetId);
    }

    await logAction(req.user.id, "column", col.id, "create", null, req.body, req);

    const io = getIO();
    if (io) io.to(`sheet:${spreadsheetId}`).emit("column_updated", { action: "added", sheetId: spreadsheetId, column: col.toJSON() });

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

    // Trigger formula recalculation if column has a formula
    if (col.formulaExpr) {
      const { recalculateFormulas } = await import("../spreadsheet/spreadsheet.controller.js");
      await recalculateFormulas(col.spreadsheetId);
    }

    await logAction(req.user.id, "column", col.id, "update", old, req.body, req);

    const io = getIO();
    if (io) io.to(`sheet:${col.spreadsheetId}`).emit("column_updated", { action: "updated", sheetId: col.spreadsheetId, column: col.toJSON() });

    res.json({ data: col, message: "Column updated" });
  } catch (e) { next(e); }
};

export const deleteColumn = async (req, res, next) => {
  try {
    const col = await Column.findByPk(req.params.colId);
    if (!col) throw new AppError("Column not found", 404);
    await col.update({ isDeleted: true });
    await logAction(req.user.id, "column", col.id, "delete", null, null, req);

    const io = getIO();
    if (io) io.to(`sheet:${col.spreadsheetId}`).emit("column_updated", { action: "deleted", sheetId: col.spreadsheetId, columnId: col.id });

    res.json({ message: "Column deleted" });
  } catch (e) { next(e); }
};

// ── Move Column Left ──────────────────────────────────────────────────────────
export const moveColumnLeft = async (req, res, next) => {
  try {
    const col = await Column.findByPk(req.params.colId);
    if (!col) throw new AppError("Column not found", 404);
    if (col.orderIndex === 0) throw new AppError("Column is already at the leftmost position", 400);

    const prev = await Column.findOne({
      where: { spreadsheetId: col.spreadsheetId, orderIndex: col.orderIndex - 1, isDeleted: false }
    });
    if (!prev) throw new AppError("No column to the left", 400);

    await sequelize.transaction(async (t) => {
      await col.update({ orderIndex: prev.orderIndex }, { transaction: t });
      await prev.update({ orderIndex: col.orderIndex }, { transaction: t });
    });

    const io = getIO();
    if (io) io.to(`sheet:${col.spreadsheetId}`).emit("column_updated", { action: "reordered", sheetId: col.spreadsheetId });

    res.json({ message: "Column moved left" });
  } catch (e) { next(e); }
};

// ── Move Column Right ─────────────────────────────────────────────────────────
export const moveColumnRight = async (req, res, next) => {
  try {
    const col = await Column.findByPk(req.params.colId);
    if (!col) throw new AppError("Column not found", 404);

    const next_ = await Column.findOne({
      where: { spreadsheetId: col.spreadsheetId, orderIndex: col.orderIndex + 1, isDeleted: false }
    });
    if (!next_) throw new AppError("No column to the right", 400);

    await sequelize.transaction(async (t) => {
      await col.update({ orderIndex: next_.orderIndex }, { transaction: t });
      await next_.update({ orderIndex: col.orderIndex }, { transaction: t });
    });

    const io = getIO();
    if (io) io.to(`sheet:${col.spreadsheetId}`).emit("column_updated", { action: "reordered", sheetId: col.spreadsheetId });

    res.json({ message: "Column moved right" });
  } catch (e) { next(e); }
};

// ── Reorder Columns (bulk) ────────────────────────────────────────────────────
export const reorderColumns = async (req, res, next) => {
  try {
    const { id: spreadsheetId } = req.params;
    const { columns } = req.body; // [{ id, orderIndex }]
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

// ── Toggle Column Visibility ──────────────────────────────────────────────────
export const toggleColumnHidden = async (req, res, next) => {
  try {
    const col = await Column.findByPk(req.params.colId);
    if (!col) throw new AppError("Column not found", 404);
    await col.update({ isHidden: !col.isHidden });

    const io = getIO();
    if (io) io.to(`sheet:${col.spreadsheetId}`).emit("column_updated", {
      action: "visibility_changed", sheetId: col.spreadsheetId, columnId: col.id, isHidden: col.isHidden
    });

    res.json({ data: { isHidden: col.isHidden }, message: `Column ${col.isHidden ? "hidden" : "shown"}` });
  } catch (e) { next(e); }
};

// ── Toggle Column Lock ────────────────────────────────────────────────────────
export const toggleColumnLocked = async (req, res, next) => {
  try {
    const col = await Column.findByPk(req.params.colId);
    if (!col) throw new AppError("Column not found", 404);
    await col.update({ isLocked: !col.isLocked });
    res.json({ data: { isLocked: col.isLocked }, message: `Column ${col.isLocked ? "locked" : "unlocked"}` });
  } catch (e) { next(e); }
};

// ── Permission management ─────────────────────────────────────────────────────
export const setPermission = shareSheet; // alias – same handler

export const listPermissions = async (req, res, next) => {
  try {
    const perms = await SheetPermission.findAll({
      where: { spreadsheetId: req.params.id },
      include: [{ model: User, attributes: ["id", "name", "email", "role", "avatar"] }]
    });
    const colPerms = await ColumnPermission.findAll({ where: { sheetId: req.params.id } });
    res.json({ data: { sheetPermissions: perms, columnPermissions: colPerms } });
  } catch (e) { next(e); }
};

// ── Audit log access ──────────────────────────────────────────────────────────
export const getAuditForSheet = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const { rows, count } = await AuditLog.findAndCountAll({
      where: { meta: { spreadsheetId: req.params.id } },
      limit, offset,
      order: [["createdAt", "DESC"]]
    });
    res.json({ data: rows, meta: getMeta(page, limit, count) });
  } catch (e) { next(e); }
};

// ── List active users in sheet (presence from socket) ────────────────────────
export const listActiveUsers = async (req, res, next) => {
  try {
    const io = getIO();
    const roomName = `sheet:${req.params.id}`;
    const socketIds = io ? [...(io.sockets.adapter.rooms.get(roomName) || [])] : [];
    const activeUsers = socketIds.map(sid => {
      const s = io.sockets.sockets.get(sid);
      return s?.user ? { id: s.user.id, name: s.user.name, email: s.user.email } : null;
    }).filter(Boolean);
    res.json({ data: activeUsers });
  } catch (e) { next(e); }
};
