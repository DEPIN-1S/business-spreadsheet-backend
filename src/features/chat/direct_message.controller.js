import DirectMessage from "./direct_message.model.js";
import User from "../user/user.model.js";
import AppError from "../../utils/AppError.js";
import { getPagination, getMeta } from "../../utils/pagination.js";
import { getIO } from "../../config/socket.js";
import { Op } from "sequelize";

// ── Send a direct message (text or file) ────────────────────────────────────
export const sendDirectMessage = async (req, res, next) => {
    try {
        const senderId = req.user.id;
        const { receiverId } = req.params;
        const { message, fileType = "text", duration } = req.body;

        if (senderId === receiverId) throw new AppError("Cannot send message to yourself", 400);

        const receiver = await User.findByPk(receiverId, { attributes: ["id", "name", "avatar"] });
        if (!receiver) throw new AppError("Receiver not found", 404);

        // fileUrl comes either from multipart upload or body (external URL)
        const fileUrl = req.file
            ? `/uploads/audio/${req.file.filename}`
            : (req.body.fileUrl || null);

        const resolvedFileType = req.file ? "audio" : fileType;

        if (!message && !fileUrl) throw new AppError("Message or file is required", 400);

        const dm = await DirectMessage.create({
            senderId, receiverId,
            message: message || null,
            fileUrl,
            fileType: resolvedFileType,
            duration: duration || null
        });

        const sender = { id: req.user.id, name: req.user.name, avatar: req.user.avatar };
        const payload = { ...dm.toJSON(), sender, receiver: receiver.toJSON() };

        // Emit to receiver's personal room
        const io = getIO();
        if (io) {
            io.to(`user:${receiverId}`).emit("direct_message", payload);
            io.to(`user:${senderId}`).emit("direct_message", payload); // echo to sender
        }

        res.status(201).json({ data: payload, message: "Message sent" });
    } catch (e) { next(e); }
};

// ── Get conversation between two users ───────────────────────────────────────
export const getConversation = async (req, res, next) => {
    try {
        const myId = req.user.id;
        const { userId } = req.params;
        const { page, limit, offset } = getPagination(req);

        const { count, rows } = await DirectMessage.findAndCountAll({
            where: {
                isDeleted: false,
                [Op.or]: [
                    { senderId: myId, receiverId: userId },
                    { senderId: userId, receiverId: myId }
                ]
            },
            order: [["createdAt", "ASC"]],
            limit,
            offset,
            include: [
                { model: User, as: "sender", attributes: ["id", "name", "avatar"] },
                { model: User, as: "receiver", attributes: ["id", "name", "avatar"] }
            ]
        });

        // Mark received messages as read
        await DirectMessage.update(
            { isRead: true },
            { where: { senderId: userId, receiverId: myId, isRead: false } }
        );

        res.json({ data: rows, meta: getMeta(page, limit, count) });
    } catch (e) { next(e); }
};

// ── List all conversations (inbox) ────────────────────────────────────────────
export const getInbox = async (req, res, next) => {
    try {
        const myId = req.user.id;

        // Get latest message per conversation partner
        const messages = await DirectMessage.findAll({
            where: {
                isDeleted: false,
                [Op.or]: [{ senderId: myId }, { receiverId: myId }]
            },
            order: [["createdAt", "DESC"]],
            include: [
                { model: User, as: "sender", attributes: ["id", "name", "avatar"] },
                { model: User, as: "receiver", attributes: ["id", "name", "avatar"] }
            ]
        });

        // Deduplicate: keep only latest message per partner
        const seen = new Set();
        const inbox = [];
        for (const msg of messages) {
            const partnerId = msg.senderId === myId ? msg.receiverId : msg.senderId;
            if (!seen.has(partnerId)) {
                seen.add(partnerId);

                // Count unread
                const unread = await DirectMessage.count({
                    where: { senderId: partnerId, receiverId: myId, isRead: false, isDeleted: false }
                });
                inbox.push({ ...msg.toJSON(), unreadCount: unread });
            }
        }

        res.json({ data: inbox });
    } catch (e) { next(e); }
};

// ── Delete a message (soft delete, sender only) ───────────────────────────────
export const deleteDirectMessage = async (req, res, next) => {
    try {
        const { messageId } = req.params;
        const dm = await DirectMessage.findByPk(messageId);
        if (!dm) throw new AppError("Message not found", 404);
        if (dm.senderId !== req.user.id) throw new AppError("Can only delete your own messages", 403);

        await dm.update({ isDeleted: true });

        const io = getIO();
        if (io) {
            io.to(`user:${dm.receiverId}`).emit("message_deleted", { messageId, conversationWith: dm.senderId });
            io.to(`user:${dm.senderId}`).emit("message_deleted", { messageId, conversationWith: dm.receiverId });
        }

        res.json({ message: "Message deleted" });
    } catch (e) { next(e); }
};

// ── Mark conversation as read ─────────────────────────────────────────────────
export const markAsRead = async (req, res, next) => {
    try {
        const myId = req.user.id;
        const { userId } = req.params;
        await DirectMessage.update(
            { isRead: true },
            { where: { senderId: userId, receiverId: myId, isRead: false } }
        );
        res.json({ message: "Marked as read" });
    } catch (e) { next(e); }
};

// ── Send audio message (upload handler) ───────────────────────────────────────
export const sendAudioMessage = async (req, res, next) => {
    try {
        if (!req.file) throw new AppError("Audio file is required", 400);
        // Reuse sendDirectMessage logic — req.file already set by multer
        return sendDirectMessage(req, res, next);
    } catch (e) { next(e); }
};
