import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import jwt from "jsonwebtoken";
import ChatMessage from "../features/chat/chatmessage.model.js";
import User from "../features/user/user.model.js";
import logger from "./logger.js";

let io = null;
let redisClient = null;

export function initSocket(httpServer) {
    const allowedOrigins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "https://datsheets.in",
        "https://www.datsheets.in"
    ];

    io = new Server(httpServer, {
        cors: {
            origin: allowedOrigins,
            methods: ["GET", "POST"]
        },
        transports: ["websocket", "polling"]
    });

    // ── Redis Setup ─────────────────────────────────────────────────────────────
    const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();
    redisClient = pubClient;

    pubClient.on('error', (err) => logger.error('Redis Pub Client Error', err));
    subClient.on('error', (err) => logger.error('Redis Sub Client Error', err));

    Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
        io.adapter(createAdapter(pubClient, subClient));
        logger.info("✅ Redis Adapter connected");
    }).catch(err => {
        logger.error("❌ Redis Adapter connection failed: " + err.message);
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

    io.on("connection", async (socket) => {
        logger.info(`Socket connected: ${socket.user?.name} (${socket.id})`);

        // ── Personal user room (for direct messages) ──────────────────────────
        socket.join(`user:${socket.user.id}`);

        const uid = socket.user.id;

        try {
            // Track online status in Redis
            await redisClient.sAdd(`user:${uid}:sockets`, socket.id);
            await redisClient.sAdd(`online_users_set`, uid);

            // Broadcast "online" to all clients
            io.emit("user_status", { userId: uid, name: socket.user.name, status: "online" });

            // Send current online users list to the connecting client
            const onlineList = await redisClient.sMembers(`online_users_set`);
            socket.emit("online_users", onlineList);
        } catch (err) {
            logger.error(`Redis Error during connection: ${err.message}`);
        }

        // DM typing indicator
        socket.on("dm_typing", ({ receiverId, isTyping }) => {
            socket.to(`user:${receiverId}`).emit("dm_typing", {
                senderId: socket.user.id,
                name: socket.user.name,
                isTyping
            });
        });

        // ── Sheet collaboration events ────────────────────────────────────────

        socket.on("join_sheet", async (sheetId) => {
            socket.join(`sheet:${sheetId}`);

            try {
                // Store user info in this sheet's Redis Hash
                const userData = JSON.stringify({
                    userId: socket.user.id,
                    name: socket.user.name,
                    email: socket.user.email
                });
                await redisClient.hSet(`sheet:${sheetId}:presence`, socket.id, userData);
                
                // Track which sheets this socket has joined (for disconnect cleanup)
                await redisClient.sAdd(`socket:${socket.id}:sheets`, sheetId);

                socket.to(`sheet:${sheetId}`).emit("user_joined_sheet", {
                    userId: socket.user.id,
                    name: socket.user.name,
                    at: new Date().toISOString()
                });

                // Send current presence list to the joining user
                const presenceMap = await redisClient.hGetAll(`sheet:${sheetId}:presence`);
                const presentUsers = Object.values(presenceMap).map(v => JSON.parse(v));
                
                // Deduplicate by userId in case they have multiple tabs open
                const uniqueUsers = Array.from(new Map(presentUsers.map(u => [u.userId, u])).values());

                socket.emit("sheet_presence", { sheetId, users: uniqueUsers });
                logger.info(`${socket.user.name} joined sheet room: ${sheetId}`);
            } catch (err) {
                logger.error(`Redis Error during join_sheet: ${err.message}`);
            }
        });

        socket.on("leave_sheet", async (sheetId) => {
            await _leaveSheet(socket, sheetId);
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

        socket.on("get_online_users", async () => {
            try {
                const onlineList = await redisClient.sMembers(`online_users_set`);
                socket.emit("online_users", onlineList);
            } catch (err) {
                logger.error(`Redis Error fetching online users: ${err.message}`);
            }
        });

        socket.on("disconnect", async () => {
            logger.info(`Socket disconnected: ${socket.user?.name}`);
            try {
                // 1. Leave all sheets this socket was in
                const activeSheets = await redisClient.sMembers(`socket:${socket.id}:sheets`);
                for (const sheetId of activeSheets) {
                    await _leaveSheet(socket, sheetId);
                }
                await redisClient.del(`socket:${socket.id}:sheets`);

                // 2. Remove socket from online tracking
                const userId = socket.user?.id;
                if (userId) {
                    await redisClient.sRem(`user:${userId}:sockets`, socket.id);
                    const remainingSockets = await redisClient.sCard(`user:${userId}:sockets`);
                    
                    if (remainingSockets === 0) {
                        // User has fully disconnected from all tabs
                        await redisClient.sRem(`online_users_set`, userId);
                        io.emit("user_status", { userId: userId, name: socket.user?.name, status: "offline" });
                    }
                }
            } catch (err) {
                logger.error(`Redis Error during disconnect: ${err.message}`);
            }
        });
    });

    return io;
}

// ── Internal: remove socket from sheet presence & notify room ─────────────────
async function _leaveSheet(socket, sheetId) {
    socket.leave(`sheet:${sheetId}`);
    try {
        await redisClient.hDel(`sheet:${sheetId}:presence`, socket.id);
        await redisClient.sRem(`socket:${socket.id}:sheets`, sheetId);
        
        socket.to(`sheet:${sheetId}`).emit("user_left_sheet", {
            userId: socket.user?.id,
            name: socket.user?.name
        });
    } catch (err) {
        logger.error(`Redis Error during _leaveSheet: ${err.message}`);
    }
}

// ── Public helpers for controllers to emit events ─────────────────────────────

export function emitToSheet(sheetId, event, payload) {
    if (io) io.to(`sheet:${sheetId}`).emit(event, payload);
}

export function getIO() {
    return io;
}
