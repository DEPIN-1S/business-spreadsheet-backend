import multer from "multer";
import path from "path";
import crypto from "crypto";
import { createR2Storage } from "../services/r2.js";

const ALLOWED_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf"
];

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf"];

const storage = createR2Storage({
    filename(req, file, cb) {
        const unique = crypto.randomBytes(16).toString("hex");
        const ext = path.extname(file.originalname).toLowerCase() || ".bin";
        cb(null, `${unique}${ext}`);
    },
    key(req, file, filename) {
        return `uploads/dm-files/${filename}`;
    }
});

const fileFilter = (req, file, cb) => {
    const mimeOk = ALLOWED_MIME_TYPES.includes(file.mimetype);
    const extOk = ALLOWED_EXTENSIONS.includes(path.extname(file.originalname).toLowerCase());

    if (mimeOk || extOk) {
        cb(null, true);
    } else {
        cb(new Error("Invalid file type. Allowed: JPG, PNG, GIF, WebP, PDF"), false);
    }
};

export const fileUpload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024  // 50 MB max
    }
});
