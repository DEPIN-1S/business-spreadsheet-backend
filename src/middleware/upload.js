import multer from "multer";
import path from "path";
import fs from "fs";
import AppError from "../utils/AppError.js";

const UPLOAD_ROOT = process.env.UPLOAD_DIR || "uploads";
const MAX_MB = parseInt(process.env.MAX_FILE_SIZE_MB || "50");

// Ensure sub-directories exist
["images", "audio", "documents", "videos", "chat"].forEach(dir => {
    const p = path.join(process.cwd(), UPLOAD_ROOT, dir);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

const storage = multer.diskStorage({
    destination(req, file, cb) {
        const mime = file.mimetype;
        let subDir = "documents";
        if (mime.startsWith("image/")) subDir = "images";
        else if (mime.startsWith("audio/")) subDir = "audio";
        else if (mime.startsWith("video/")) subDir = "videos";
        cb(null, path.join(process.cwd(), UPLOAD_ROOT, subDir));
    },
    filename(req, file, cb) {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    }
});

function fileFilter(req, file, cb) {
    const allowed = [
        "image/jpeg", "image/png", "image/gif", "image/webp",
        "audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4",
        "video/mp4", "video/webm",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/plain", "text/csv"
    ];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new AppError(`File type not allowed: ${file.mimetype}`, 400), false);
}

export const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: MAX_MB * 1024 * 1024 }
});

// Helper to derive fileType category from mimetype
export function getFileType(mimeType) {
    if (!mimeType) return "other";
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("audio/")) return "audio";
    if (mimeType.startsWith("video/")) return "video";
    return "document";
}

export default upload;
