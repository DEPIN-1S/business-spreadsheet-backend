import Folder from "./folder.model.js";
import FolderPermission from "./folder_permission.model.js";
import Spreadsheet from "./spreadsheet.model.js";
import AppError from "../../utils/AppError.js";
import { logAction } from "../../utils/auditLogger.js";
import { Op } from "sequelize";
import sequelize from "../../config/db.js";

// ── Helper: check for circular parentId assignment ───────────────────────────
async function wouldCreateCycle(folderId, newParentId) {
    if (!newParentId) return false;
    if (newParentId === folderId) return true;

    // Walk up the new parent's ancestry; if we hit folderId → cycle
    let current = newParentId;
    const visited = new Set();
    while (current) {
        if (visited.has(current)) return true; // existing cycle
        visited.add(current);
        if (current === folderId) return true;
        const parent = await Folder.findOne({ where: { id: current, isDeleted: false }, attributes: ["parentId"] });
        current = parent?.parentId || null;
    }
    return false;
}

// ── Helper: build nested folder tree recursively ─────────────────────────────
async function buildTree(parentId, userId, role) {
    const where = { parentId: parentId || null, isDeleted: false };

    let folders;
    if (role === "staff") {
        // Staff can only see folders they have FolderPermission for
        const perms = await FolderPermission.findAll({ where: { userId, canView: true }, attributes: ["folderId"] });
        const allowedIds = perms.map(p => p.folderId);
        where.id = { [Op.in]: allowedIds };
    }

    folders = await Folder.findAll({ where, order: [["name", "ASC"]] });

    return Promise.all(folders.map(async (folder) => {
        const children = await buildTree(folder.id, userId, role);
        const sheets = await Spreadsheet.findAll({
            where: { folderId: folder.id, isDeleted: false },
            attributes: ["id", "name", "createdAt"]
        });
        return { ...folder.toJSON(), children, sheets };
    }));
}

// ── Create Folder ─────────────────────────────────────────────────────────────
export const createFolder = async (req, res, next) => {
    try {
        const { name, parentId } = req.body;
        if (!name?.trim()) throw new AppError("Folder name is required", 400);

        if (parentId) {
            const parent = await Folder.findOne({ where: { id: parentId, isDeleted: false } });
            if (!parent) throw new AppError("Parent folder not found", 404);
        }

        const folder = await Folder.create({ name: name.trim(), parentId: parentId || null, createdBy: req.user.id });
        await logAction(req.user.id, "folder", folder.id, "create", null, { name, parentId }, req);

        res.status(201).json({ data: folder, message: "Folder created" });
    } catch (e) { next(e); }
};

// ── Rename or Move Folder ─────────────────────────────────────────────────────
export const updateFolder = async (req, res, next) => {
    try {
        const { name, parentId } = req.body;
        const folder = await Folder.findOne({ where: { id: req.params.id, isDeleted: false } });
        if (!folder) throw new AppError("Folder not found", 404);

        // Circular reference check when moving
        if (parentId !== undefined && parentId !== folder.parentId) {
            const cycle = await wouldCreateCycle(folder.id, parentId);
            if (cycle) throw new AppError("Cannot move folder: would create a circular reference", 422);
        }

        const old = { name: folder.name, parentId: folder.parentId };
        const updates = {};
        if (name !== undefined) updates.name = name.trim();
        if (parentId !== undefined) updates.parentId = parentId || null;

        await folder.update(updates);
        await logAction(req.user.id, "folder", folder.id, "update", old, updates, req);

        res.json({ data: folder, message: "Folder updated" });
    } catch (e) { next(e); }
};

// ── Soft Delete Folder (cascades to children + sheets) ───────────────────────
export const deleteFolder = async (req, res, next) => {
    try {
        const folder = await Folder.findOne({ where: { id: req.params.id, isDeleted: false } });
        if (!folder) throw new AppError("Folder not found", 404);

        // Collect all descendant folder IDs
        const allIds = [folder.id];
        const collectDescendants = async (parentId) => {
            const children = await Folder.findAll({ where: { parentId, isDeleted: false }, attributes: ["id"] });
            for (const child of children) {
                allIds.push(child.id);
                await collectDescendants(child.id);
            }
        };
        await collectDescendants(folder.id);

        await sequelize.transaction(async (t) => {
            // Soft-delete all descendant folders
            await Folder.update({ isDeleted: true }, { where: { id: { [Op.in]: allIds } }, transaction: t });
            // Soft-delete all sheets inside any of these folders
            await Spreadsheet.update({ isDeleted: true }, { where: { folderId: { [Op.in]: allIds } }, transaction: t });
        });

        await logAction(req.user.id, "folder", folder.id, "delete", null, { ids: allIds }, req);
        res.json({ message: "Folder and all its contents deleted" });
    } catch (e) { next(e); }
};

// ── Get Full Folder Tree ──────────────────────────────────────────────────────
export const getFolderTree = async (req, res, next) => {
    try {
        const { role, id: userId } = req.user;
        const tree = await buildTree(null, userId, role);
        res.json({ data: tree });
    } catch (e) { next(e); }
};

// ── Get Children of a Specific Folder ────────────────────────────────────────
export const getFolderChildren = async (req, res, next) => {
    try {
        const { role, id: userId } = req.user;
        const folder = await Folder.findOne({ where: { id: req.params.id, isDeleted: false } });
        if (!folder) throw new AppError("Folder not found", 404);

        const tree = await buildTree(folder.id, userId, role);
        res.json({ data: { folder, children: tree } });
    } catch (e) { next(e); }
};

// ── Get Breadcrumb (ancestor chain) ──────────────────────────────────────────
export const getBreadcrumb = async (req, res, next) => {
    try {
        const breadcrumb = [];
        let currentId = req.params.id;

        while (currentId) {
            const folder = await Folder.findOne({
                where: { id: currentId, isDeleted: false },
                attributes: ["id", "name", "parentId"]
            });
            if (!folder) break;
            breadcrumb.unshift({ id: folder.id, name: folder.name });
            currentId = folder.parentId;
        }

        res.json({ data: breadcrumb });
    } catch (e) { next(e); }
};

// ── Set Folder Permission (Admin only) ────────────────────────────────────────
export const setFolderPermission = async (req, res, next) => {
    try {
        const { userId, canView = true, canEdit = false } = req.body;
        const { id: folderId } = req.params;

        const folder = await Folder.findOne({ where: { id: folderId, isDeleted: false } });
        if (!folder) throw new AppError("Folder not found", 404);

        const [perm, created] = await FolderPermission.upsert(
            { folderId, userId, canView, canEdit },
            { returning: true }
        );
        res.status(created ? 201 : 200).json({ data: Array.isArray(perm) ? perm[0] : perm, message: "Permission set" });
    } catch (e) { next(e); }
};
