import multer from "multer";
import path from "path";
import crypto from "crypto";
import { createR2Storage } from "../services/r2.js";

const ALLOWED_AUDIO_TYPES = [
    "audio/mpeg",        // .mp3
    "audio/wav",         // .wav
    "audio/ogg",         // .ogg
    "audio/webm",        // .webm (browser MediaRecorder default)
    "audio/mp4",         // .m4a
    "audio/aac",         // .aac
    "audio/x-m4a"        // .m4a variant
];

const ALLOWED_EXTENSIONS = [".mp3", ".wav", ".ogg", ".webm", ".m4a", ".aac"];

const storage = createR2Storage({
    filename(req, file, cb) {
        const unique = crypto.randomBytes(16).toString("hex");
        const ext = path.extname(file.originalname).toLowerCase() || ".webm";
        cb(null, `${unique}${ext}`);
    },
    key(req, file, filename) {
        return `uploads/audio/${filename}`;
    }
});

const fileFilter = (req, file, cb) => {
    const mimeOk = ALLOWED_AUDIO_TYPES.includes(file.mimetype);
    const extOk = ALLOWED_EXTENSIONS.includes(path.extname(file.originalname).toLowerCase());

    if (mimeOk || extOk) {
        cb(null, true);
    } else {
        cb(new Error(`Invalid audio file type. Allowed: mp3, wav, ogg, webm, m4a, aac`), false);
    }
};

export const audioUpload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 25 * 1024 * 1024  // 25 MB max
    }
});
