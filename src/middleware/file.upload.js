import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";

// ── Ensure upload directory exists ──────────────────────────────────────────
const DM_FILES_DIR = "uploads/dm-files";
if (!fs.existsSync(DM_FILES_DIR)) fs.mkdirSync(DM_FILES_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf"
];

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf"];

// ── Storage configuration ───────────────────────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, DM_FILES_DIR),
    filename: (req, file, cb) => {
        const unique = crypto.randomBytes(16).toString("hex");
        const ext = path.extname(file.originalname).toLowerCase() || ".bin";
        cb(null, `${unique}${ext}`);
    }
});

// ── File type validation ────────────────────────────────────────────────────
const fileFilter = (req, file, cb) => {
    const mimeOk = ALLOWED_MIME_TYPES.includes(file.mimetype);
    const extOk = ALLOWED_EXTENSIONS.includes(path.extname(file.originalname).toLowerCase());

    if (mimeOk || extOk) {
        cb(null, true);
    } else {
        cb(new Error("Invalid file type. Allowed: JPG, PNG, GIF, WebP, PDF"), false);
    }
};

// ── Export configured multer instance ───────────────────────────────────────
export const fileUpload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024  // 50 MB max
    }
});
