import "express-async-errors";
import express from "express";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import responseFormatter from "./middleware/responseFormatter.js";
import errorHandler from "./middleware/error.js";

// Routes
import userRoutes from "./features/user/user.routes.js";
import adminRoutes from "./features/admin/admin.routes.js";
import superadminRoutes from "./features/superadmin/superadmin.routes.js";
import sheetRoutes from "./features/spreadsheet/spreadsheet.routes.js";
import folderRoutes from "./features/spreadsheet/folder.routes.js";
import mediaRoutes from "./features/media/media.routes.js";
import chatRoutes from "./features/chat/chat.routes.js";
import directMessageRoutes from "./features/chat/direct_message.routes.js";
import auditRoutes from "./features/audit/audit.routes.js";
import inventoryRoutes from "./features/inventory/inventory.routes.js";

const app = express();

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
    origin: process.env.FRONTEND_URL || "*",
    credentials: true
}));

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." }
}));

// Auth endpoints: stricter rate limit
app.use("/api/user/login", rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: "Too many login attempts. Try again in 15 minutes." }
}));

app.get("/", (req, res) => {
  res.send("Spreadsheet backend is running");
});

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Static file serving ───────────────────────────────────────────────────────
const UPLOAD_ROOT = process.env.UPLOAD_DIR || "uploads";
app.use("/uploads", express.static(path.join(process.cwd(), UPLOAD_ROOT)));
app.use("/images", express.static(path.join(process.cwd(), "public/images")));
app.use("/pdf", express.static(path.join(process.cwd(), "public/pdf")));
app.use("/csv", express.static(path.join(process.cwd(), "public/csv")));

// ── Response formatter ────────────────────────────────────────────────────────
app.use(responseFormatter);

// ── API Routes ────────────────────────────────────────────────────────────────
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/superadmin", superadminRoutes);
app.use("/api/sheets", sheetRoutes);
app.use("/api/folders", folderRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/dm", directMessageRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/inventory", inventoryRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (req, res) => res.json({ status: "ok", ts: new Date().toISOString() }));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use(errorHandler);

export default app;
