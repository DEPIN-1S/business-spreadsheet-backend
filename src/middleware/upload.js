import multer from "multer";
import path from "path";
import AppError from "../utils/AppError.js";
import { createR2Storage } from "../services/r2.js";
import { isAllowedUpload } from "./uploadPolicy.js";

const MAX_MB = parseInt(process.env.MAX_FILE_SIZE_MB || "50");

// Helper to derive fileType category from mimetype
export function getFileType(mimeType, originalname = "") {
    if (mimeType?.startsWith("image/")) return "image";
    if (mimeType?.startsWith("audio/")) return "audio";
    if (mimeType?.startsWith("video/")) return "video";
    const ext = path.extname(originalname || "").toLowerCase();
    if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tif", ".tiff", ".heic", ".heif", ".heics", ".heifs", ".avif"].includes(ext)) {
        return "image";
    }
    if ([".mp3", ".wav", ".ogg", ".m4a", ".webm"].includes(ext)) return "audio";
    if ([".mp4", ".mov", ".webm"].includes(ext)) return "video";
    if (mimeType || ext) return "document";
    return "other";
}

const storage = createR2Storage({
    filename(req, file, cb) {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
    key(req, file, filename) {
        return `uploads/${getFileType(file.mimetype, file.originalname)}s/${filename}`;
    }
});

function fileFilter(req, file, cb) {
    if (isAllowedUpload(file.mimetype, file.originalname)) return cb(null, true);
    const label = file.mimetype || path.extname(file.originalname || "") || "unknown";
    cb(new AppError(`File type not allowed: ${label}`, 400), false);
}

export const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: MAX_MB * 1024 * 1024 }
});

export default upload;
