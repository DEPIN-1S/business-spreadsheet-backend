import ChatRoom from "./chatroom.model.js";
import ChatMessage from "./chatmessage.model.js";
import User from "../user/user.model.js";
import AppError from "../../utils/AppError.js";
import { getPagination, getMeta } from "../../utils/pagination.js";
import { getIO } from "../../config/socket.js";

export const createRoom = async (req, res, next) => {
    try {
        const { spreadsheetId, name } = req.body;
        const room = await ChatRoom.create({ spreadsheetId, name });
        res.status(201).json({ data: room, message: "Chat room created" });
    } catch (e) { next(e); }
};

export const listRooms = async (req, res, next) => {
    try {
        const where = {};
        if (req.query.sheetId) where.spreadsheetId = req.query.sheetId;
        const rooms = await ChatRoom.findAll({ where, order: [["createdAt", "DESC"]] });
        res.json({ data: rooms });
    } catch (e) { next(e); }
};

export const getMessages = async (req, res, next) => {
    try {
        const { page, limit, offset } = getPagination(req);
        const room = await ChatRoom.findByPk(req.params.roomId);
        if (!room) throw new AppError("Room not found", 404);
        const { rows, count } = await ChatMessage.findAndCountAll({
            where: { roomId: req.params.roomId },
            limit, offset,
            order: [["createdAt", "DESC"]],
            include: [{ model: User, as: "author", attributes: ["id", "name", "email"] }]
        });
        res.json({ data: rows.reverse(), meta: getMeta(page, limit, count) });
    } catch (e) { next(e); }
};

// REST fallback for sending a message (Socket.IO is primary)
export const sendMessage = async (req, res, next) => {
    try {
        const room = await ChatRoom.findByPk(req.params.roomId);
        if (!room) throw new AppError("Room not found", 404);
        const msg = await ChatMessage.create({
            roomId: req.params.roomId,
            userId: req.user.id,
            message: req.body.message,
            fileUrl: req.body.fileUrl || null
        });
        // Broadcast via Socket.IO
        const io = getIO();
        if (io) {
            const author = await User.findByPk(req.user.id, { attributes: ["id", "name", "email"] });
            io.to(`room:${req.params.roomId}`).emit("receive_message", {
                ...msg.toJSON(),
                author
            });
        }
        res.status(201).json({ data: msg });
    } catch (e) { next(e); }
};
