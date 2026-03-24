import SheetPermission from "../features/spreadsheet/permission.model.js";
import AppError from "../utils/AppError.js";
import logger from "../config/logger.js";

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

        logger.info(`[DEBUG] checkSheetPermission START: action=${action}, userId=${userId}, sheetId=${sheetId}`);
        const perm = await SheetPermission.findOne({ where: { userId, spreadsheetId: sheetId } });
        
        if (!perm) {
            const allUserPerms = await SheetPermission.findAll({ where: { userId } });
            logger.warn(`[DEBUG] No permission found for userId=${userId}, sheetId=${sheetId}. User has ${allUserPerms.length} total perms.`);
            if (allUserPerms.length > 0) {
                logger.warn(`[DEBUG] First available spreadsheetId for user: ${allUserPerms[0].spreadsheetId}`);
            }
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
        req.sheetPermission = sheetId
            ? await SheetPermission.findOne({ where: { userId, spreadsheetId: sheetId } })
            : null;
        next();
    } catch (err) { next(err); }
};
