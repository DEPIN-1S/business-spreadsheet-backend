import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "./user.model.js";
import AppError from "../../utils/AppError.js";
import { getPagination, getMeta } from "../../utils/pagination.js";
import { logAction } from "../../utils/auditLogger.js";

export const register = async (req, res, next) => {
  try {
    const { name, email, password, phone, role } = req.body;
    const existing = await User.findOne({ where: { email } });
    if (existing) throw new AppError("Email already registered", 409);
    const hash = await bcrypt.hash(password, 10);
    // Only admins/superadmins can create admin/superadmin accounts
    const assignedRole = (req.user && ["admin", "superadmin"].includes(req.user.role))
      ? (role || "staff")
      : "staff";
    const user = await User.create({ name, email, password: hash, phone, role: assignedRole });
    await logAction(req.user?.id || null, "user", user.id, "create", null, { email, role: assignedRole }, req);
    res.status(201).json({ data: { id: user.id, email: user.email, role: user.role, name: user.name }, message: "Registered successfully" });
  } catch (e) { next(e); }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email, isActive: true } });
    if (!user) throw new AppError("Invalid credentials", 401);
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new AppError("Invalid credentials", 401);
    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );
    await logAction(user.id, "user", user.id, "login", null, null, req);
    res.json({ data: { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } }, message: "Login successful" });
  } catch (e) { next(e); }
};

export const me = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ["password"] }
    });
    if (!user) throw new AppError("User not found", 404);
    res.json({ data: user });
  } catch (e) { next(e); }
};

export const getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const where = {};
    if (req.query.role) where.role = req.query.role;
    if (req.query.isActive !== undefined) where.isActive = req.query.isActive === "true";
    const { rows, count } = await User.findAndCountAll({
      where,
      limit,
      offset,
      attributes: { exclude: ["password"] },
      order: [["createdAt", "DESC"]]
    });
    res.json({ data: rows, meta: getMeta(page, limit, count) });
  } catch (e) { next(e); }
};

export const updateUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) throw new AppError("User not found", 404);
    const old = { name: user.name, email: user.email, role: user.role, isActive: user.isActive };
    const { name, email, phone, role, isActive, password } = req.body;
    if (password) req.body.password = await bcrypt.hash(password, 10);
    await user.update({ name, email, phone, role, isActive, ...(password && { password: req.body.password }) });
    await logAction(req.user.id, "user", user.id, "update", old, { name, email, role, isActive }, req);
    res.json({ data: { id: user.id, name: user.name, email: user.email, role: user.role }, message: "User updated" });
  } catch (e) { next(e); }
};

export const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) throw new AppError("User not found", 404);
    await user.update({ isActive: false });
    await logAction(req.user.id, "user", user.id, "delete", { isActive: true }, { isActive: false }, req);
    res.json({ message: "User deactivated" });
  } catch (e) { next(e); }
};
