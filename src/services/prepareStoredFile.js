import path from "path";
import AppError from "../utils/AppError.js";

const HEIC_MIME = new Set([
    "image/heic",
    "image/heif",
    "image/heic-sequence",
    "image/heif-sequence"
]);
const HEIC_EXT = new Set([".heic", ".heif", ".heics", ".heifs"]);
const EXT_MIME = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
    ".pdf": "application/pdf"
};

export function isHeicUpload(file, filename = "") {
    const mime = String(file?.mimetype || "").toLowerCase();
    const ext = path.extname(file?.originalname || filename || "").toLowerCase();
    return HEIC_MIME.has(mime) || HEIC_EXT.has(ext);
}

async function convertHeicToJpeg(body) {
    const mod = await import("heic-convert");
    const convert = typeof mod.default === "function" ? mod.default : mod;
    const jpeg = await convert({ buffer: body, format: "JPEG", quality: 0.9 });
    return Buffer.from(jpeg);
}

export async function prepareStoredBody(file, filename, body) {
    if (!isHeicUpload(file, filename)) {
        const mime = String(file?.mimetype || "").toLowerCase();
        const ext = path.extname(file?.originalname || filename || "").toLowerCase();
        const contentType = !mime || mime === "application/octet-stream"
            ? (EXT_MIME[ext] || file?.mimetype || "application/octet-stream")
            : file.mimetype;
        return { filename, body, contentType };
    }

    try {
        const jpeg = await convertHeicToJpeg(body);
        const jpegName = `${filename.replace(/\.[^.]+$/i, "")}.jpg`;
        return { filename: jpegName, body: jpeg, contentType: "image/jpeg" };
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError("This photo could not be read. Save it as JPG and upload again.", 400);
    }
}
