import bcrypt from "bcryptjs";
import { Op } from "sequelize";
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
    const { name, email, phone, role, avatar } = req.body;

    // Check if phone already registered
    const existingPhone = await User.findOne({ where: { phone } });
    if (existingPhone) throw new AppError("Phone number already registered", 409);

    if (email) {
      const existingEmail = await User.findOne({ where: { email } });
      if (existingEmail) throw new AppError("Email already registered", 409);
    }

    const assignedRole = (req.user && ["admin", "superadmin"].includes(req.user.role))
      ? (role || "staff")
      : "staff";

    const user = await User.create({ name, email, phone, avatar, role: assignedRole });
    await logAction(req.user?.id || null, "user", user.id, "create", null, { phone, role: assignedRole }, req);

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

// ── MSG91 OTP API Integration ───────────────────────────────────────────────

export const sendLoginOtp = async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) throw new AppError("Phone number is required", 400);

    const user = await User.findOne({ where: { phone, isActive: true } });
    if (!user) throw new AppError("User not found or inactive", 404);

    if (process.env.NODE_ENV !== "production") {
      // Bypass MSG91 for all users in non-production environments
      const generatedOtp = "1234";
      await user.update({
        loginOtp: generatedOtp,
        loginOtpExpiry: new Date(Date.now() + 10 * 60 * 1000)
      });
    } else {
      // Call MSG91 API to send OTP
      const TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID;
      const AUTH_KEY = process.env.MSG91_AUTH_KEY;
      const SENDER_ID = process.env.MSG91_SENDER_ID;
    
      
      // Generate exactly 4 digits for the OTP
      const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
      
      const payload = {
        template_id: TEMPLATE_ID,
        short_url: "0",
        recipients: [
          {
            mobiles: `91${phone}`,
            OTP: String(generatedOtp)
          }
        ]
      };

      const url = "https://control.msg91.com/api/v5/flow/";
      const response = await fetch(url, { 
        method: "POST",
        headers: { "authkey": AUTH_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      
      console.log(`[MSG91 SEND OTP RESPONSE for ${phone}]:`, data);

      if (data.type === "error" || data.hasError) {
        throw new AppError(data.message || "Failed to send OTP", 500);
      }

      // Store in DB with 10 mins expiry
      await user.update({
        loginOtp: generatedOtp,
        loginOtpExpiry: new Date(Date.now() + 10 * 60 * 1000)
      });
    }

    // Only for logging purposes, no db state changed
    await logAction(user.id, "user", user.id, "otp_sent", null, null, req);

    res.json({ message: "OTP sent successfully" });
  } catch (e) { next(e); }
};

export const verifyLoginOtp = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) throw new AppError("Phone number and OTP are required", 400);

    const user = await User.findOne({ where: { phone, isActive: true } });
    if (!user) throw new AppError("User not found or inactive", 404);

    if (process.env.NODE_ENV !== "production" && otp === "1234") {
      // Bypass MSG91 for all users in non-production environments 
    } else {
      // Local OTP Verification
      if (!user.loginOtp || user.loginOtp !== otp) {
         throw new AppError("Invalid OTP", 401);
      }
      if (!user.loginOtpExpiry || new Date() > user.loginOtpExpiry) {
         throw new AppError("OTP has expired", 401);
      }
      
      // Clear OTP after successful use
      await user.update({ loginOtp: null, loginOtpExpiry: null });
    }

    await logAction(user.id, "user", user.id, "login", null, null, req);

    const accessToken = signAccessToken(user);
    const refreshToken = await createRefreshToken(user.id);

    res.json({
      data: {
        accessToken,
        refreshToken,
        user: { id: user.id, name: user.name, phone: user.phone, email: user.email, role: user.role, avatar: user.avatar }
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

// ── Search users (Authenticated, all roles) ───────────────────────────────────

export const searchUsers = async (req, res, next) => {
  try {
    const { q, limit = 20 } = req.query;
    const where = { isActive: true };

    if (q) {
      where[Op.or] = [
        { name: { [Op.like]: `%${q}%` } },
        { email: { [Op.like]: `%${q}%` } },
        { phone: { [Op.like]: `%${q}%` } }
      ];
    }

    const users = await User.findAll({
      where,
      limit: parseInt(limit, 10),
      attributes: ["id", "name", "email", "phone", "avatar", "role"], // Safe fields
      order: [["name", "ASC"]]
    });

    res.json({ data: users });
  } catch (e) { next(e); }
};

// ── Update user ───────────────────────────────────────────────────────────────

export const updateUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) throw new AppError("User not found", 404);
    const old = { name: user.name, email: user.email, phone: user.phone, role: user.role, isActive: user.isActive };
    const { name, email, phone, role, isActive, avatar } = req.body;
    const updates = { name, email, phone, role, isActive, avatar };

    await user.update(updates);
    await logAction(req.user.id, "user", user.id, "update", old, { name, email, phone, role, isActive }, req);
    res.json({ data: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, avatar: user.avatar }, message: "User updated" });
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
