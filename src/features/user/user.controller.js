import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "./user.model.js";
import RefreshToken from "./refresh_token.model.js";
import AppError from "../../utils/AppError.js";
import { getPagination, getMeta } from "../../utils/pagination.js";
import { logAction } from "../../utils/auditLogger.js";

// ── Token helpers ────────────────────────────────────────────────────────────

function signAccessToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || "15m" }
  );
}

async function createRefreshToken(userId) {
  const token = crypto.randomBytes(64).toString("hex");
  const days = parseInt(process.env.JWT_REFRESH_DAYS || "7", 10);
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await RefreshToken.create({ userId, token, expiresAt });
  return token;
}

// ── Register ─────────────────────────────────────────────────────────────────

export const register = async (req, res, next) => {
  try {
    const { name, email, password, phone, role, avatar } = req.body;
    const existing = await User.findOne({ where: { email } });
    if (existing) throw new AppError("Email already registered", 409);

    const hash = await bcrypt.hash(password, 10);
    const assignedRole = (req.user && ["admin", "superadmin"].includes(req.user.role))
      ? (role || "staff")
      : "staff";

    const user = await User.create({ name, email, password: hash, phone, avatar, role: assignedRole });
    await logAction(req.user?.id || null, "user", user.id, "create", null, { email, role: assignedRole }, req);

    const accessToken = signAccessToken(user);
    const refreshToken = await createRefreshToken(user.id);

    res.status(201).json({
      data: {
        accessToken,
        refreshToken,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar }
      },
      message: "Registered successfully"
    });
  } catch (e) { next(e); }
};

// ── Login ─────────────────────────────────────────────────────────────────────

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email, isActive: true } });
    if (!user) throw new AppError("Invalid credentials", 401);

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new AppError("Invalid credentials", 401);

    await logAction(user.id, "user", user.id, "login", null, null, req);

    const accessToken = signAccessToken(user);
    const refreshToken = await createRefreshToken(user.id);

    res.json({
      data: {
        accessToken,
        refreshToken,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar }
      },
      message: "Login successful"
    });
  } catch (e) { next(e); }
};

// ── Refresh Token ─────────────────────────────────────────────────────────────

export const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) throw new AppError("Refresh token required", 400);

    const stored = await RefreshToken.findOne({ where: { token } });
    if (!stored || stored.isRevoked) throw new AppError("Invalid or revoked refresh token", 401);
    if (new Date() > stored.expiresAt) {
      await stored.update({ isRevoked: true });
      throw new AppError("Refresh token expired", 401);
    }

    // Revoke old token (rotation)
    await stored.update({ isRevoked: true });

    const user = await User.findByPk(stored.userId, { attributes: { exclude: ["password"] } });
    if (!user || !user.isActive) throw new AppError("User not found or inactive", 401);

    const accessToken = signAccessToken(user);
    const newRefreshToken = await createRefreshToken(user.id);

    res.json({
      data: { accessToken, refreshToken: newRefreshToken },
      message: "Token refreshed"
    });
  } catch (e) { next(e); }
};

// ── Logout ────────────────────────────────────────────────────────────────────

export const logout = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    if (token) {
      await RefreshToken.update({ isRevoked: true }, { where: { token } });
    }
    await logAction(req.user?.id || null, "user", req.user?.id || null, "logout", null, null, req);
    res.json({ message: "Logged out successfully" });
  } catch (e) { next(e); }
};

// ── Me ────────────────────────────────────────────────────────────────────────

export const me = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, { attributes: { exclude: ["password"] } });
    if (!user) throw new AppError("User not found", 404);
    res.json({ data: user });
  } catch (e) { next(e); }
};

// ── List all users (admin+) ───────────────────────────────────────────────────

export const getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const where = {};
    if (req.query.role) where.role = req.query.role;
    if (req.query.isActive !== undefined) where.isActive = req.query.isActive === "true";
    const { rows, count } = await User.findAndCountAll({
      where, limit, offset,
      attributes: { exclude: ["password"] },
      order: [["createdAt", "DESC"]]
    });
    res.json({ data: rows, meta: getMeta(page, limit, count) });
  } catch (e) { next(e); }
};

// ── Update user ───────────────────────────────────────────────────────────────

export const updateUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) throw new AppError("User not found", 404);
    const old = { name: user.name, email: user.email, role: user.role, isActive: user.isActive };
    const { name, email, phone, role, isActive, password, avatar } = req.body;
    const updates = { name, email, phone, role, isActive, avatar };
    if (password) updates.password = await bcrypt.hash(password, 10);
    await user.update(updates);
    await logAction(req.user.id, "user", user.id, "update", old, { name, email, role, isActive }, req);
    res.json({ data: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar }, message: "User updated" });
  } catch (e) { next(e); }
};

// ── Delete (deactivate) user ──────────────────────────────────────────────────

export const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) throw new AppError("User not found", 404);
    await user.update({ isActive: false });
    // Revoke all refresh tokens for this user
    await RefreshToken.update({ isRevoked: true }, { where: { userId: user.id } });
    await logAction(req.user.id, "user", user.id, "delete", { isActive: true }, { isActive: false }, req);
    res.json({ message: "User deactivated" });
  } catch (e) { next(e); }
};
