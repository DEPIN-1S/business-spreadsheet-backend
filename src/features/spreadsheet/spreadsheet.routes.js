import express from "express";
import {
    listSheets, getSheetData, updateSheet,
    updateCell, addRow, deleteRow, reorderRow, updateRowColor, upsertCell, recalculateFormulas,
    bulkInsertRows,
    addColumn, updateColumn, deleteColumn,
    moveColumnLeft, moveColumnRight, reorderColumns,
    toggleColumnHidden, toggleColumnLocked,
    shareSheet, updateShareRole, removeShare, getSharedWithMe, setPermission, listPermissions,
    createSheet, getSheet, deleteSheet, duplicateSheet,
    exportSheet, importSheet, copyRow
} from "./spreadsheet.controller.js";
import { protect } from "../../middleware/auth.js";
import { checkSheetPermission } from "../../middleware/rbac.js";
import { validate, schemas } from "../../middleware/validate.js";
import commentRoutes from "./comment.routes.js";
import { getCommentCounts } from "./comment.controller.js";

const router = express.Router();
router.use(protect());

// Spreadsheet List & CRUD
router.get("/", listSheets); // Unified listing
router.get("/shared", (req, res, next) => { req.query.shared = "true"; next(); }, listSheets);
router.post("/", validate(schemas.createSheet), createSheet);
router.post("/import", importSheet);
router.get("/:id", checkSheetPermission("view"), getSheet);
router.get("/:id/export", checkSheetPermission("view"), exportSheet);
router.put("/:id", checkSheetPermission("admin"), updateSheet);
router.delete("/:id", checkSheetPermission("admin"), deleteSheet);
router.post("/:id/duplicate", checkSheetPermission("view"), duplicateSheet);

// Grid data
router.get("/:id/data", checkSheetPermission("view"), getSheetData);

// Cell operations
router.put("/:id/cells/:cellId", checkSheetPermission("edit"), validate(schemas.updateCell), updateCell);
router.post("/:id/cells", checkSheetPermission("edit"), upsertCell);

// Column management
router.post("/:id/columns", checkSheetPermission("admin"), addColumn);
router.put("/:id/columns/:colId", checkSheetPermission("admin"), updateColumn);
router.delete("/:id/columns/:colId", checkSheetPermission("admin"), deleteColumn);
router.patch("/:id/columns/:colId/move-left", checkSheetPermission("admin"), moveColumnLeft);
router.patch("/:id/columns/:colId/move-right", checkSheetPermission("admin"), moveColumnRight);
router.put("/:id/columns/reorder", checkSheetPermission("admin"), reorderColumns);
router.patch("/:id/columns/:colId/toggle-hidden", checkSheetPermission("admin"), toggleColumnHidden);
router.patch("/:id/columns/:colId/toggle-locked", checkSheetPermission("admin"), toggleColumnLocked);

// Sharing & permissions
router.post("/:id/share", checkSheetPermission("admin"), validate(schemas.shareSheet), shareSheet);
router.get("/:id/permissions", checkSheetPermission("admin"), listPermissions);
router.put("/:id/permissions/:userId", checkSheetPermission("admin"), validate(schemas.updateShareRole), updateShareRole);
router.delete("/:id/permissions/:userId", checkSheetPermission("admin"), removeShare);

// Row management
router.post("/:id/rows", checkSheetPermission("edit"), addRow);
router.delete("/:id/rows/:rowId", checkSheetPermission("admin"), deleteRow); // Admin only delete row?
router.patch("/:id/rows/:rowId/order", checkSheetPermission("edit"), reorderRow);
router.patch("/:id/rows/:rowId/color", checkSheetPermission("edit"), updateRowColor);
router.post("/:id/rows/:rowId/copy", checkSheetPermission("edit"), copyRow);
router.post("/:id/rows/bulk", checkSheetPermission("edit"), bulkInsertRows);

// Comments
router.get("/:sheetId/comment-counts", getCommentCounts);
router.use("/:sheetId/cells/:cellId/comments", commentRoutes);

export default router;
