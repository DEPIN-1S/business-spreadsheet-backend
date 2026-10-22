import path from "path";

const ALLOWED_MIME = new Set([
    "image/jpeg",
    "image/jpg",
    "image/pjpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/bmp",
    "image/tiff",
    "image/heic",
    "image/heif",
    "image/heic-sequence",
    "image/heif-sequence",
    "image/avif",
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
    "audio/mp4",
    "video/mp4",
    "video/webm",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/csv"
]);

// Phones often send HEIC/JPEG with a blank or generic MIME type.
const EXTENSION_WHEN_MIME_MISSING = new Set([
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".bmp",
    ".tif",
    ".tiff",
    ".heic",
    ".heif",
    ".heics",
    ".heifs",
    ".avif",
    ".pdf"
]);

export function isAllowedUpload(mimetype, originalname) {
    const mime = String(mimetype || "").toLowerCase();
    if (ALLOWED_MIME.has(mime)) return true;
    const ext = path.extname(originalname || "").toLowerCase();
    const mimeMissing = !mime || mime === "application/octet-stream";
    return mimeMissing && EXTENSION_WHEN_MIME_MISSING.has(ext);
}
