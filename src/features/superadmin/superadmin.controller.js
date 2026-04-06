import User from "../user/user.model.js";
import Spreadsheet from "../spreadsheet/spreadsheet.model.js";
import AuditLog from "../audit/auditlog.model.js";
import InventoryItem from "../inventory/inventory.model.js";
import ChatMessage from "../chat/chatmessage.model.js";
import sequelize from "../../config/db.js";
import { getPagination, getMeta } from "../../utils/pagination.js";
import AppError from "../../utils/AppError.js";
import { logAction } from "../../utils/auditLogger.js";
import fs from "fs";
import path from "path";

export const analytics = async (req, res, next) => {
  try {
    const [userCount, sheetCount, msgCount, itemCount] = await Promise.all([
      User.count(),
      Spreadsheet.count({ where: { isDeleted: false } }),
      ChatMessage.count(),
      InventoryItem.count({ where: { isDeleted: false } })
    ]);
    const roleBreakdown = await User.findAll({
      attributes: ["role", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
      group: ["role"],
      raw: true
    });
    const recentActivity = await AuditLog.findAll({ limit: 10, order: [["createdAt", "DESC"]], include: [{ model: User, as: "user", attributes: ["name", "email"] }] });
    res.json({ data: { userCount, sheetCount, msgCount, itemCount, roleBreakdown, recentActivity } });
  } catch (e) { next(e); }
};

export const listUsers = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const where = {};
    if (req.query.role) where.role = req.query.role;
    const { rows, count } = await User.findAndCountAll({ where, limit, offset, attributes: { exclude: ["password"] }, order: [["createdAt", "DESC"]] });
    res.json({ data: rows, meta: getMeta(page, limit, count) });
  } catch (e) { next(e); }
};

export const createUser = async (req, res, next) => {
  try {
    const existing = await User.findOne({ where: { phone: req.body.phone } });
    if (existing) throw new AppError("Phone already registered", 409);
    
    // Remove password from req.body if it exists
    const { password, ...userData } = req.body;
    
    const user = await User.create({ ...userData, createdBy: req.user.id });
    await logAction(req.user.id, "user", user.id, "create", null, { phone: user.phone, role: user.role }, req);
    res.status(201).json({ data: { id: user.id, name: user.name, phone: user.phone, role: user.role } });
  } catch (e) { next(e); }
};

export const updateUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) throw new AppError("User not found", 404);
    const old = user.toJSON();
    
    // Remove password from req.body to prevent accidental overrides or issues
    const { password, ...updateData } = req.body;
    
    await user.update(updateData);
    await logAction(req.user.id, "user", user.id, "update", old, updateData, req);
    res.json({ data: { id: user.id, name: user.name, role: user.role } });
  } catch (e) { next(e); }
};

export const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) throw new AppError("User not found", 404);
    await user.destroy();
    await logAction(req.user.id, "user", req.params.id, "delete", null, null, req);
    res.json({ message: "User deleted" });
  } catch (e) { next(e); }
};

export const backup = async (req, res, next) => {
  try {
    const [users, sheets, logs] = await Promise.all([
      User.findAll({ attributes: { exclude: ["password"] }, raw: true }),
      Spreadsheet.findAll({ raw: true }),
      AuditLog.findAll({ limit: 5000, order: [["createdAt", "DESC"]], raw: true })
    ]);
    const snapshot = { exportedAt: new Date().toISOString(), users, sheets, recentAudit: logs };
    await logAction(req.user.id, "sheet", "backup", "export", null, { count: users.length + sheets.length }, req);
    res.setHeader("Content-Disposition", `attachment; filename=backup-${Date.now()}.json`);
    res.json(snapshot);
  } catch (e) { next(e); }
};

export const restore = async (req, res, next) => {
  try {
    // Minimal restore: upsert users from backup payload
    const { users = [] } = req.body;
    for (const u of users) {
      const { password, ...userData } = u;
      await User.upsert({ ...userData });
    }
    await logAction(req.user.id, "user", "restore", "create", null, { restored: users.length }, req);
    res.json({ message: `Restore complete: ${users.length} users processed` });
  } catch (e) { next(e); }
};
