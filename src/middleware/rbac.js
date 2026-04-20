import SheetPermission from "../features/spreadsheet/permission.model.js";
import FolderPermission from "../features/spreadsheet/folder_permission.model.js";
import Spreadsheet from "../features/spreadsheet/spreadsheet.model.js";
import Folder from "../features/spreadsheet/folder.model.js";
import AppError from "../utils/AppError.js";
import logger from "../config/logger.js";

/**
 * Recursive check for folder permissions.
 * Walks up the folder tree to find if the user has permission on any parent.
 */
export async function getInheritedPermission(userId, folderId) {
    let currentFolderId = folderId;
    while (currentFolderId) {
        const folderPerm = await FolderPermission.findOne({ where: { userId, folderId: currentFolderId, canView: true } });
        if (folderPerm) return folderPerm;
        
        const folder = await Folder.findOne({ where: { id: currentFolderId, isDeleted: false }, attributes: ["parentId"] });
        if (!folder || !folder.parentId) break;
        currentFolderId = folder.parentId;
    }
    return null;
}

/**
 * Check that the logged-in user has the required permission on a spreadsheet.
 * @param {"view"|"edit"|"formula"} action
 * Expects req.params.id or req.params.sheetId to be the spreadsheet UUID.
 * Admin and superadmin bypass all checks.
 */
export const checkSheetPermission = (action = "view") => async (req, res, next) => {
    try {
        const { role, id: userId } = req.user;
        // Admins and superadmins always have full access
        if (role === "admin" || role === "superadmin") return next();

        const sheetId = req.params.id || req.params.sheetId;
        if (!sheetId) throw new AppError("Sheet ID missing", 400);

        let perm = await SheetPermission.findOne({ where: { userId, spreadsheetId: sheetId } });
        
        if (perm) {
            logger.info(`[DEBUG] Found direct SheetPermission for userId=${userId}, sheetId=${sheetId}`);
        } else if (role === "staff") {
            logger.info(`[DEBUG] No direct SheetPermission, checking owner/inheritance for staff user=${userId}, sheetId=${sheetId}`);
            
            // Fetch sheet to check owner (createdBy) and folderId
            const sheet = await Spreadsheet.findOne({ where: { id: sheetId, isDeleted: false }, attributes: ["id", "folderId", "createdBy"] });
            
            if (sheet) {
                // 1. Owner Check
                if (sheet.createdBy === userId) {
                    perm = {
                        userId,
                        spreadsheetId: sheetId,
                        canView: true,
                        canEdit: true,
                        canEditFormulas: true,
                        role: "admin",
                        isOwner: true
                    };
                    logger.info(`[DEBUG] User is owner of sheet=${sheetId}`);
                } 
                // 2. Inheritance Check
                else if (sheet.folderId) {
                    const folderPerm = await getInheritedPermission(userId, sheet.folderId);
                    if (folderPerm) {
                        perm = {
                            userId,
                            spreadsheetId: sheetId,
                            canView: true,
                            canEdit: folderPerm.canEdit,
                            canEditFormulas: false,
                            role: folderPerm.canEdit ? "editor" : "viewer",
                            isInherited: true
                        };
                        logger.info(`[DEBUG] Inherited recursive permission from folder=${folderPerm.folderId}`);
                    }
                }
            } else {
                logger.error(`[DEBUG] Spreadsheet not found for sheetId=${sheetId}`);
            }
        }

        if (!perm) {
            logger.error(`[DEBUG] PERMISSION DENIED: userId=${userId}, sheetId=${sheetId}, role=${role}`);
            throw new AppError("No permission for this spreadsheet", 403);
        }

        logger.info(`[DEBUG] Found permission: canView=${perm.canView}, canEdit=${perm.canEdit}, role=${perm.role}`);

        if (action === "view" && !perm.canView) throw new AppError("View access denied", 403);
        if (action === "edit" && !perm.canEdit) throw new AppError("Edit access denied", 403);
        if (action === "formula" && !perm.canEditFormulas) throw new AppError("Formula edit access denied", 403);

        req.sheetPermission = perm;
        next();
    } catch (err) { next(err); }
};

/**
 * Attach permission to req without throwing (for optional checks)
 */
export const attachSheetPermission = async (req, res, next) => {
    try {
        const { role, id: userId } = req.user;
        if (role === "admin" || role === "superadmin") {
            req.sheetPermission = null; // signals full access
            return next();
        }
        const sheetId = req.params.id || req.params.sheetId;
        if (!sheetId) return next();

        let perm = await SheetPermission.findOne({ where: { userId, spreadsheetId: sheetId } });
        if (!perm) {
            const sheet = await Spreadsheet.findOne({ where: { id: sheetId, isDeleted: false }, attributes: ["folderId", "createdBy"] });
            if (sheet) {
                if (sheet.createdBy === userId) {
                    perm = {
                        userId,
                        spreadsheetId: sheetId,
                        canView: true,
                        canEdit: true,
                        canEditFormulas: true,
                        role: "admin",
                        isOwner: true
                    };
                } else if (sheet.folderId) {
                    const folderPerm = await getInheritedPermission(userId, sheet.folderId);
                    if (folderPerm) {
                        perm = {
                            userId,
                            spreadsheetId: sheetId,
                            canView: true,
                            canEdit: folderPerm.canEdit,
                            canEditFormulas: false,
                            role: folderPerm.canEdit ? "editor" : "viewer",
                            isInherited: true
                        };
                    }
                }
            }
        }
        req.sheetPermission = perm;
        next();
    } catch (err) { next(err); }
};
