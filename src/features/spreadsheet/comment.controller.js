import Comment from "./comment.model.js";
import Cell from "./cell.model.js";
import SheetPermission from "./permission.model.js";
import FolderPermission from "./folder_permission.model.js";
import Spreadsheet from "./spreadsheet.model.js";
import ColumnPermission from "./column_permission.model.js";
import User from "../user/user.model.js";
import AppError from "../../utils/AppError.js";
import { getIO } from "../../config/socket.js";
import { logAction } from "../../utils/auditLogger.js";
import sequelize from "../../config/db.js";
import { getInheritedPermission } from "../../middleware/rbac.js";

// ── Add Comment ───────────────────────────────────────────────────────────────
export const addComment = async (req, res, next) => {
    try {
        const { sheetId, cellId } = req.params;
        const { text } = req.body;
        const { id: userId, role } = req.user;

        if (!text?.trim()) throw new AppError("Comment text is required", 400);

        // Permission check for staff (direct, owner, or inherited from folder)
        if (role === "staff") {
            let perm = await SheetPermission.findOne({ where: { userId, spreadsheetId: sheetId } });
            if (!perm) {
                const sheet = await Spreadsheet.findOne({ where: { id: sheetId, isDeleted: false }, attributes: ["folderId", "createdBy"] });
                if (sheet) {
                    if (sheet.createdBy === userId) {
                        perm = { canView: true, canEdit: true };
                    } else if (sheet.folderId) {
                        perm = await getInheritedPermission(userId, sheet.folderId);
                    }
                }
            }
            if (!perm || !perm.canView) throw new AppError("No access to this sheet", 403);
        }

        const cell = await Cell.findByPk(cellId);
        if (!cell) throw new AppError("Cell not found", 404);

        const comment = await Comment.create({ cellId, sheetId, userId, text: text.trim() });

        // Fetch with author info for response + socket payload
        const author = await User.findByPk(userId, { attributes: ["id", "name", "email", "avatar"] });
        const payload = { ...comment.toJSON(), author };

        // Real-time broadcast
        const io = getIO();
        if (io) io.to(`sheet:${sheetId}`).emit("comment_added", payload);

        await logAction(userId, "comment", comment.id, "create", null, { cellId, sheetId }, req);
        res.status(201).json({ data: payload, message: "Comment added" });
    } catch (e) { next(e); }
};

// ── List Comments for a Cell ──────────────────────────────────────────────────
export const listComments = async (req, res, next) => {
    try {
        const { sheetId, cellId } = req.params;
        const { id: userId, role } = req.user;

        if (role === "staff") {
            let perm = await SheetPermission.findOne({ where: { userId, spreadsheetId: sheetId } });
            if (!perm) {
                const sheet = await Spreadsheet.findOne({ where: { id: sheetId, isDeleted: false }, attributes: ["folderId", "createdBy"] });
                if (sheet) {
                    if (sheet.createdBy === userId) {
                        perm = { canView: true, canEdit: true };
                    } else if (sheet.folderId) {
                        perm = await getInheritedPermission(userId, sheet.folderId);
                    }
                }
            }
            if (!perm || !perm.canView) throw new AppError("No access to this sheet", 403);
        }

        const comments = await Comment.findAll({
            where: { cellId, sheetId, isDeleted: false },
            order: [["createdAt", "ASC"]]
        });

        // Attach user details
        const userIds = [...new Set(comments.map(c => c.userId))];
        const users = await User.findAll({ where: { id: userIds }, attributes: ["id", "name", "email", "avatar"] });
        const userMap = Object.fromEntries(users.map(u => [u.id, u.toJSON()]));

        const result = comments.map(c => ({ ...c.toJSON(), author: userMap[c.userId] || null }));
        res.json({ data: result });
    } catch (e) { next(e); }
};

// ── Edit Comment ──────────────────────────────────────────────────────────────
export const editComment = async (req, res, next) => {
    try {
        const { commentId, sheetId } = req.params;
        const { text } = req.body;
        const { id: userId, role } = req.user;

        const comment = await Comment.findOne({ where: { id: commentId, isDeleted: false } });
        if (!comment) throw new AppError("Comment not found", 404);

        // Only the comment owner or admin can edit
        if (role === "staff" && comment.userId !== userId) {
            throw new AppError("Cannot edit another user's comment", 403);
        }

        await comment.update({ text: text.trim() });
        await logAction(userId, "comment", comment.id, "update", { text: comment.text }, { text }, req);

        res.json({ data: comment, message: "Comment updated" });
    } catch (e) { next(e); }
};

// ── Delete Comment ────────────────────────────────────────────────────────────
export const deleteComment = async (req, res, next) => {
    try {
        const { commentId, sheetId } = req.params;
        const { id: userId, role } = req.user;

        const comment = await Comment.findOne({ where: { id: commentId, isDeleted: false } });
        if (!comment) throw new AppError("Comment not found", 404);

        if (role === "staff" && comment.userId !== userId) {
            throw new AppError("Cannot delete another user's comment", 403);
        }

        await comment.update({ isDeleted: true });

        const io = getIO();
        if (io) io.to(`sheet:${sheetId}`).emit("comment_deleted", { commentId, cellId: comment.cellId, sheetId });

        await logAction(userId, "comment", comment.id, "delete", null, null, req);
        res.json({ message: "Comment deleted" });
    } catch (e) { next(e); }
};

// ── Comment Counts for a Sheet ────────────────────────────────────────────────
export const getCommentCounts = async (req, res, next) => {
    try {
        const { sheetId } = req.params;
        const { id: userId, role } = req.user;

        if (role === "staff") {
            let perm = await SheetPermission.findOne({ where: { userId, spreadsheetId: sheetId } });
            if (!perm) {
                const sheet = await Spreadsheet.findOne({ where: { id: sheetId, isDeleted: false }, attributes: ["folderId", "createdBy"] });
                if (sheet) {
                    if (sheet.createdBy === userId) {
                        perm = { canView: true, canEdit: true };
                    } else if (sheet.folderId) {
                        perm = await getInheritedPermission(userId, sheet.folderId);
                    }
                }
            }
            if (!perm || !perm.canView) throw new AppError("No access to this sheet", 403);
        }

        const counts = await Comment.findAll({
            where: { sheetId, isDeleted: false },
            attributes: ["cellId", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
            group: ["cellId"],
            raw: true
        });

        const map = {};
        counts.forEach(c => { map[c.cellId] = parseInt(c.count); });
        res.json({ data: map });
    } catch (e) { next(e); }
};
