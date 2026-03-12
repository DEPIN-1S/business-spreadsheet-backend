import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import ChatMessage from "../features/chat/chatmessage.model.js";
import User from "../features/user/user.model.js";
import logger from "./logger.js";

let io = null;

/**
 * Active sheet users: Map<sheetId, Map<socketId, {userId, name, email}>>
 */
const sheetPresence = new Map();

export function initSocket(httpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL || "*",
            methods: ["GET", "POST"]
        }
    });

    // ── JWT middleware ──────────────────────────────────────────────────────────
    io.use((socket, next) => {
        try {
            const token = socket.handshake.auth?.token || socket.handshake.query?.token;
            if (!token) return next(new Error("Unauthorized"));
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.user = decoded;
            next();
        } catch {
            next(new Error("Unauthorized"));
        }
    });

    io.on("connection", (socket) => {
        logger.info(`Socket connected: ${socket.user?.name} (${socket.id})`);

        // ── Personal user room (for direct messages) ──────────────────────────
        // Every user auto-joins their own room so DMs can be delivered instantly
        socket.join(`user:${socket.user.id}`);

        // DM typing indicator
        socket.on("dm_typing", ({ receiverId, isTyping }) => {
            socket.to(`user:${receiverId}`).emit("dm_typing", {
                senderId: socket.user.id,
                name: socket.user.name,
                isTyping
            });
        });

        // ── Sheet collaboration events ────────────────────────────────────────

        socket.on("join_sheet", (sheetId) => {
            socket.join(`sheet:${sheetId}`);

            if (!sheetPresence.has(sheetId)) sheetPresence.set(sheetId, new Map());
            sheetPresence.get(sheetId).set(socket.id, {
                userId: socket.user.id,
                name: socket.user.name,
                email: socket.user.email
            });

            // Notify others in room
            socket.to(`sheet:${sheetId}`).emit("user_joined_sheet", {
                userId: socket.user.id,
                name: socket.user.name,
                at: new Date().toISOString()
            });

            // Send current presence list to the joining user
            const presentUsers = [...sheetPresence.get(sheetId).values()];
            socket.emit("sheet_presence", { sheetId, users: presentUsers });
            logger.info(`${socket.user.name} joined sheet room: ${sheetId}`);
        });

        socket.on("leave_sheet", (sheetId) => {
            _leaveSheet(socket, sheetId);
        });

        // ── Chat room events ──────────────────────────────────────────────────

        socket.on("join_room", (roomId) => {
            socket.join(`room:${roomId}`);
            socket.to(`room:${roomId}`).emit("user_joined", {
                userId: socket.user.id, name: socket.user.name, at: new Date().toISOString()
            });
        });

        socket.on("leave_room", (roomId) => {
            socket.leave(`room:${roomId}`);
            socket.to(`room:${roomId}`).emit("user_left", { userId: socket.user.id, name: socket.user.name });
        });

        socket.on("send_message", async ({ roomId, message, fileUrl, fileType }) => {
            try {
                if (!roomId || (!message && !fileUrl)) return;
                const msg = await ChatMessage.create({
                    roomId, userId: socket.user.id,
                    message: message || null, fileUrl: fileUrl || null, fileType: fileType || null
                });
                const author = { id: socket.user.id, name: socket.user.name, email: socket.user.email };
                io.to(`room:${roomId}`).emit("receive_message", { ...msg.toJSON(), author });
            } catch (err) {
                socket.emit("error", { message: err.message });
            }
        });

        socket.on("typing", ({ roomId, isTyping }) => {
            socket.to(`room:${roomId}`).emit("user_typing", {
                userId: socket.user.id, name: socket.user.name, isTyping
            });
        });

        // ── Presence ──────────────────────────────────────────────────────────
        socket.on("set_status", (status) => {
            io.emit("user_status", { userId: socket.user.id, name: socket.user.name, status });
        });

        socket.on("disconnect", () => {
            logger.info(`Socket disconnected: ${socket.user?.name}`);
            // Remove from all sheet presence maps
            for (const [sheetId] of sheetPresence) {
                _leaveSheet(socket, sheetId);
            }
            io.emit("user_status", { userId: socket.user?.id, name: socket.user?.name, status: "offline" });
        });
    });

    return io;
}

// ── Internal: remove socket from sheet presence & notify room ─────────────────
function _leaveSheet(socket, sheetId) {
    socket.leave(`sheet:${sheetId}`);
    if (sheetPresence.has(sheetId)) {
        sheetPresence.get(sheetId).delete(socket.id);
        if (sheetPresence.get(sheetId).size === 0) sheetPresence.delete(sheetId);
    }
    socket.to(`sheet:${sheetId}`).emit("user_left_sheet", {
        userId: socket.user?.id,
        name: socket.user?.name
    });
}

// ── Public helpers for controllers to emit events ─────────────────────────────

/**
 * Emit an event to all users in a sheet room.
 * @param {string} sheetId
 * @param {string} event
 * @param {object} payload
 */
export function emitToSheet(sheetId, event, payload) {
    if (io) io.to(`sheet:${sheetId}`).emit(event, payload);
}

export function getIO() {
    return io;
}
