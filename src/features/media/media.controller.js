import path from "path";
import fs from "fs";
import MediaFile from "./media.model.js";
import AppError from "../../utils/AppError.js";
import { getFileType } from "../../middleware/upload.js";
import { logAction } from "../../utils/auditLogger.js";

export const uploadFile = async (req, res, next) => {
    try {
        if (!req.file) throw new AppError("No file uploaded", 400);
        const { cellId } = req.body;
        const fileUrl = `/uploads/${getFileType(req.file.mimetype)}s/${req.file.filename}`;
        const media = await MediaFile.create({
            cellId: cellId || null,
            uploadedBy: req.user.id,
            fileType: getFileType(req.file.mimetype),
            mimeType: req.file.mimetype,
            fileUrl,
            originalName: req.file.originalname,
            sizeBytes: req.file.size
        });
        await logAction(req.user.id, "media", media.id, "create", null, { fileUrl, originalName: req.file.originalname }, req);
        res.status(201).json({ data: media, message: "File uploaded" });
    } catch (e) { next(e); }
};

export const getFile = async (req, res, next) => {
    try {
        const media = await MediaFile.findByPk(req.params.id);
        if (!media) throw new AppError("File not found", 404);
        res.json({ data: media });
    } catch (e) { next(e); }
};

export const deleteFile = async (req, res, next) => {
    try {
        const media = await MediaFile.findByPk(req.params.id);
        if (!media) throw new AppError("File not found", 404);
        // Delete physical file
        const filePath = path.join(process.cwd(), media.fileUrl);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        await media.destroy();
        await logAction(req.user.id, "media", req.params.id, "delete", null, null, req);
        res.json({ message: "File deleted" });
    } catch (e) { next(e); }
};

export const listFiles = async (req, res, next) => {
    try {
        const where = { uploadedBy: req.user.id };
        if (req.query.cellId) where.cellId = req.query.cellId;
        const files = await MediaFile.findAll({ where, order: [["createdAt", "DESC"]] });
        res.json({ data: files });
    } catch (e) { next(e); }
};
