import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import ChatMessage from "../features/chat/chatmessage.model.js";
import User from "../features/user/user.model.js";
import logger from "./logger.js";

let io = null;

export function initSocket(httpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL || "*",
            methods: ["GET", "POST"]
        }
    });

    // JWT authentication for socket connections
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

        // Join a chat room
        socket.on("join_room", (roomId) => {
            socket.join(`room:${roomId}`);
            socket.to(`room:${roomId}`).emit("user_joined", {
                userId: socket.user.id,
                name: socket.user.name,
                at: new Date().toISOString()
            });
        });

        // Leave a chat room
        socket.on("leave_room", (roomId) => {
            socket.leave(`room:${roomId}`);
            socket.to(`room:${roomId}`).emit("user_left", {
                userId: socket.user.id,
                name: socket.user.name
            });
        });

        // Send a message
        socket.on("send_message", async ({ roomId, message, fileUrl, fileType }) => {
            try {
                if (!roomId || (!message && !fileUrl)) return;
                const msg = await ChatMessage.create({
                    roomId,
                    userId: socket.user.id,
                    message: message || null,
                    fileUrl: fileUrl || null,
                    fileType: fileType || null
                });
                const author = { id: socket.user.id, name: socket.user.name, email: socket.user.email };
                io.to(`room:${roomId}`).emit("receive_message", { ...msg.toJSON(), author });
            } catch (err) {
                socket.emit("error", { message: err.message });
            }
        });

        // Typing indicator
        socket.on("typing", ({ roomId, isTyping }) => {
            socket.to(`room:${roomId}`).emit("user_typing", {
                userId: socket.user.id,
                name: socket.user.name,
                isTyping
            });
        });

        // Online presence – broadcast to all
        socket.on("set_status", (status) => {
            io.emit("user_status", { userId: socket.user.id, name: socket.user.name, status });
        });

        socket.on("disconnect", () => {
            logger.info(`Socket disconnected: ${socket.user?.name}`);
            io.emit("user_status", { userId: socket.user?.id, name: socket.user?.name, status: "offline" });
        });
    });

    return io;
}

export function getIO() {
    return io;
}
