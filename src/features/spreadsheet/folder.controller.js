import Folder from "./folder.model.js";
import FolderPermission from "./folder_permission.model.js";
import Spreadsheet from "./spreadsheet.model.js";
import Column from "./column.model.js";
import ColumnPermission from "./column_permission.model.js";
import User from "../user/user.model.js";
import AppError from "../../utils/AppError.js";
import { logAction } from "../../utils/auditLogger.js";
import { Op } from "sequelize";
import sequelize from "../../config/db.js";
import { copySheetInternal } from "./spreadsheet.controller.js";

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
async function buildTree(parentId, userId, role, allowedIds = null, hasParentAccess = false) {
    const where = { parentId: parentId || null, isDeleted: false };

    // If staff and NO parent access, we must filter by direct allowedIds or creator
    if (role === "staff" && !hasParentAccess) {
        where[Op.or] = [
            { id: { [Op.in]: allowedIds || [] } },
            { createdBy: userId }
        ];
    }

    const folders = await Folder.findAll({ where, order: [["name", "ASC"]] });

    return Promise.all(folders.map(async (folder) => {
        // A child inherits access if the current folder is explicitly allowed, 
        // or if we already have parent access, or if we created it.
        const childHasAccess = hasParentAccess || (allowedIds && allowedIds.includes(folder.id)) || folder.createdBy === userId;

        const children = await buildTree(folder.id, userId, role, allowedIds, childHasAccess);
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
        const { role, id: userId } = req.user;

        if (!name?.trim()) throw new AppError("Folder name is required", 400);

        if (parentId) {
            const parent = await Folder.findOne({ where: { id: parentId, isDeleted: false } });
            if (!parent) throw new AppError("Parent folder not found", 404);

            // Permission check for staff
            if (role === "staff") {
                const { getInheritedPermission } = await import("../../middleware/rbac.js");
                const perm = await getInheritedPermission(userId, parentId);
                
                // Must be owner or have edit permission
                const isOwner = parent.createdBy === userId;
                if (!isOwner && (!perm || !perm.canEdit)) {
                    throw new AppError("You do not have permission to create folders in this location", 403);
                }
            }
        }

        const existing = await Folder.findOne({ 
            where: { name: name.trim(), parentId: parentId || null, isDeleted: false } 
        });
        if (existing) throw new AppError("A folder with this name already exists in this location", 400);

        const folder = await Folder.create({ name: name.trim(), parentId: parentId || null, createdBy: req.user.id });
        await logAction(req.user.id, "folder", folder.id, "create", null, { name, parentId }, req);

        res.status(201).json({ data: folder, message: "Folder created" });
    } catch (e) { next(e); }
};

// ── Rename or Move Folder ─────────────────────────────────────────────────────
export const updateFolder = async (req, res, next) => {
    try {
        const { role, id: userId } = req.user;
        const { name, parentId } = req.body;
        const folder = await Folder.findOne({ where: { id: req.params.id, isDeleted: false } });
        if (!folder) throw new AppError("Folder not found", 404);

        // Permission check for staff
        if (role === "staff" && folder.createdBy !== userId) {
            const perms = await FolderPermission.findOne({ where: { userId, folderId: folder.id, canEdit: true } });
            if (!perms) throw new AppError("Access denied", 403);
        }

        // Circular reference check when moving
        if (parentId !== undefined && parentId !== folder.parentId) {
            const cycle = await wouldCreateCycle(folder.id, parentId);
            if (cycle) throw new AppError("Cannot move folder: would create a circular reference", 422);
        }

        const checkName = name !== undefined ? name.trim() : folder.name;
        const checkParentId = parentId !== undefined ? (parentId || null) : folder.parentId;

        if (name !== undefined || parentId !== undefined) {
            const existing = await Folder.findOne({
                where: { name: checkName, parentId: checkParentId, isDeleted: false, id: { [Op.ne]: folder.id } }
            });
            if (existing) throw new AppError("A folder with this name already exists in the target location", 400);
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
        const { role, id: userId } = req.user;
        const folder = await Folder.findOne({ where: { id: req.params.id, isDeleted: false } });
        if (!folder) throw new AppError("Folder not found", 404);

        // Permission check for staff
        if (role === "staff" && folder.createdBy !== userId) {
            // Even if they have edit permission, usually only owner/admin can delete. 
            // But if we want to follow the "superadmin" behavior, we allow owner to delete.
            throw new AppError("Only the creator or an admin can delete this folder", 403);
        }

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
        let allowedIds = null;
        
        if (role === "staff") {
            const perms = await FolderPermission.findAll({ where: { userId, canView: true }, attributes: ["folderId"] });
            allowedIds = perms.map(p => p.folderId);
            
            // For staff, we find all folders they can access
            const accessibleFolders = await Folder.findAll({
                where: {
                    isDeleted: false,
                    [Op.or]: [
                        { createdBy: userId },
                        { id: { [Op.in]: allowedIds } }
                    ]
                }
            });

            // A folder is a "root" for this user if its parent is NOT accessible to them
            const rootFolders = accessibleFolders.filter(folder => {
                if (!folder.parentId) return true;
                return !accessibleFolders.some(f => f.id === folder.parentId);
            });

            const tree = await Promise.all(rootFolders.map(async (root) => {
                const children = await buildTree(root.id, userId, role, allowedIds, true);
                const sheets = await Spreadsheet.findAll({
                    where: { folderId: root.id, isDeleted: false },
                    attributes: ["id", "name", "createdAt"]
                });
                return { ...root.toJSON(), children, sheets };
            }));

            return res.json({ data: tree });
        }

        // For admin/superadmin, start from root (parentId: null)
        const tree = await buildTree(null, userId, role, allowedIds);
        res.json({ data: tree });
    } catch (e) { next(e); }
};

// ── Get Children of a Specific Folder ────────────────────────────────────────
export const getFolderChildren = async (req, res, next) => {
    try {
        const { role, id: userId } = req.user;
        const folder = await Folder.findOne({ where: { id: req.params.id, isDeleted: false } });
        if (!folder) throw new AppError("Folder not found", 404);

        let allowedIds = null;
        if (role === "staff") {
            const perms = await FolderPermission.findAll({ where: { userId, canView: true }, attributes: ["folderId"] });
            allowedIds = perms.map(p => p.folderId);
            if (!allowedIds.includes(folder.id) && folder.createdBy !== userId) {
                throw new AppError("Access denied", 403);
            }
        }

        const tree = await buildTree(folder.id, userId, role, allowedIds);
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

// ── Sharing & Permissions ─────────────────────────────────────────────────────

export const shareFolder = async (req, res, next) => {
    try {
        const { id: folderId } = req.params;
        const { phone, email, role = "viewer", sheetColumnPermissions = {} } = req.body;

        const folder = await Folder.findOne({ where: { id: folderId, isDeleted: false } });
        if (!folder) throw new AppError("Folder not found", 404);

        const user = phone 
            ? await User.findOne({ where: { phone } })
            : await User.findOne({ where: { email } });

        if (!user) throw new AppError("User not found", 404);

        const canView = true;
        const canEdit = role === "editor" || role === "admin";

        const [perm, created] = await FolderPermission.upsert(
            { userId: user.id, folderId, canView, canEdit },
            { returning: true }
        );

        // Handle specific file-level column permissions
        if (Object.keys(sheetColumnPermissions).length > 0) {
            for (const [sheetId, colAccess] of Object.entries(sheetColumnPermissions)) {
                await ColumnPermission.upsert({
                    userId: user.id,
                    spreadsheetId: sheetId,
                    columnAccess: colAccess
                });
            }
        }

        await logAction(req.user.id, "folder_permission", folderId, created ? "create" : "update", null,
            { userId: user.id, role, canView, canEdit, sheetColumnPermissions }, req, { folderId });

        res.status(created ? 201 : 200).json({ data: Array.isArray(perm) ? perm[0] : perm, message: "Folder shared" });
    } catch (e) { next(e); }
};

export const getNestedSheets = async (req, res, next) => {
    try {
        const { id: folderId } = req.params;
        
        // 1. Find all nested folders
        const allFolderIds = [folderId];
        const collectDescendants = async (parentId) => {
            const children = await Folder.findAll({ where: { parentId, isDeleted: false }, attributes: ["id"] });
            for (const child of children) {
                allFolderIds.push(child.id);
                await collectDescendants(child.id);
            }
        };
        await collectDescendants(folderId);

        // 2. Find all sheets in these folders
        const sheets = await Spreadsheet.findAll({
            where: { folderId: { [Op.in]: allFolderIds }, isDeleted: false },
            attributes: ["id", "name"]
        });

        const sheetIds = sheets.map(s => s.id);
        
        // 3. Find columns for all these sheets
        const columns = await Column.findAll({
            where: { spreadsheetId: { [Op.in]: sheetIds }, isDeleted: false, isHidden: false },
            attributes: ["id", "name", "spreadsheetId"]
        });

        // 4. Attach columns to sheets
        const result = sheets.map(sheet => {
            const sheetJson = sheet.toJSON();
            sheetJson.Columns = columns.filter(c => c.spreadsheetId === sheet.id);
            return sheetJson;
        });

        res.json({ data: result });
    } catch (e) { next(e); }
};

export const listPermissions = async (req, res, next) => {
    try {
        const { id: folderId } = req.params;
        const perms = await FolderPermission.findAll({
            where: { folderId },
            include: [{ model: User, attributes: ["id", "name", "email", "role", "avatar", "phone"] }]
        });
        
        // Format to match ShareModal expectation
        const formattedPerms = perms.map(p => {
            const pJson = p.toJSON();
            return {
                ...pJson,
                role: p.canEdit ? "editor" : "viewer",
                User: pJson.User
            };
        });

        res.json({ data: { sheetPermissions: formattedPerms, columnPermissions: [] } });
    } catch (e) { next(e); }
};

export const removePermission = async (req, res, next) => {
    try {
        const { id: folderId, userId } = req.params;
        const perm = await FolderPermission.findOne({ where: { folderId, userId } });
        if (!perm) throw new AppError("Permission not found", 404);
        await perm.destroy();
        res.json({ message: "Access removed" });
    } catch (e) { next(e); }
};

export const setFolderPermission = shareFolder;

/**
 * Internal recursive helper to duplicate a folder and its content.
 */
async function copyFolderInternal(originalFolderId, newParentId, newName, userId, transaction) {
    const original = await Folder.findOne({ where: { id: originalFolderId, isDeleted: false }, transaction });
    if (!original) throw new AppError(`Folder ${originalFolderId} not found`, 404);

    const folderName = newName || original.name;
    const existing = await Folder.findOne({
        where: { name: folderName, parentId: newParentId || null, isDeleted: false },
        transaction
    });
    if (existing) throw new AppError(`A folder named '${folderName}' already exists in this location`, 400);

    const folder = await Folder.create({
        name: folderName,
        parentId: newParentId,

        createdBy: userId
    }, { transaction });

    // 1. Copy all sheets in this folder
    const sheets = await Spreadsheet.findAll({ where: { folderId: originalFolderId, isDeleted: false }, transaction });
    for (const sheet of sheets) {
        await copySheetInternal(sheet.id, folder.id, sheet.name, userId, transaction);
    }

    // 2. Recursively copy sub-folders
    const children = await Folder.findAll({ where: { parentId: originalFolderId, isDeleted: false }, transaction });
    for (const child of children) {
        await copyFolderInternal(child.id, folder.id, child.name, userId, transaction);
    }

    return folder;
}

export const duplicateFolder = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name: newRequestedName } = req.body;

        const original = await Folder.findOne({ where: { id, isDeleted: false } });
        if (!original) throw new AppError("Folder not found", 404);

        // Permission check for staff
        if (req.user.role === "staff") {
            const { getInheritedPermission } = await import("../../middleware/rbac.js");
            
            // 1. Must be able to view original
            const isOwner = original.createdBy === req.user.id;
            const perms = isOwner ? null : await FolderPermission.findOne({ where: { userId: req.user.id, folderId: id, canView: true } });
            if (!isOwner && !perms) throw new AppError("Access denied to original folder", 403);

            // 2. Must be able to edit parent (to create new folder there)
            if (original.parentId) {
                const parentPerm = await getInheritedPermission(req.user.id, original.parentId);
                const isParentOwner = (await Folder.findByPk(original.parentId))?.createdBy === req.user.id;
                if (!isParentOwner && (!parentPerm || !parentPerm.canEdit)) {
                    throw new AppError("You do not have permission to create folders in this location", 403);
                }
            }
        }

        let newFolder;
        await sequelize.transaction(async (t) => {
            newFolder = await copyFolderInternal(id, original.parentId, newRequestedName || `${original.name} (Copy)`, req.user.id, t);
        });

        await logAction(req.user.id, "folder", newFolder.id, "create", null, { duplicatedFrom: id }, req);
        res.status(201).json({ data: newFolder, message: "Folder duplicated" });
    } catch (e) { next(e); }
};
