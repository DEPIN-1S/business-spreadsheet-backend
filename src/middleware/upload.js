import multer from "multer";
import path from "path";
import AppError from "../utils/AppError.js";
import { createR2Storage } from "../services/r2.js";

const MAX_MB = parseInt(process.env.MAX_FILE_SIZE_MB || "50");

// Helper to derive fileType category from mimetype
export function getFileType(mimeType) {
    if (!mimeType) return "other";
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("audio/")) return "audio";
    if (mimeType.startsWith("video/")) return "video";
    return "document";
}

const storage = createR2Storage({
    filename(req, file, cb) {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
    key(req, file, filename) {
        return `uploads/${getFileType(file.mimetype)}s/${filename}`;
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

export default upload;
