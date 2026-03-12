import express from "express";
import {
    getSheetData, updateCell, addRow, deleteRow, upsertCell,
    reorderRow, updateRowColor, bulkInsertRows
} from "./spreadsheet.controller.js";
import { protect } from "../../middleware/auth.js";
import { checkSheetPermission } from "../../middleware/rbac.js";
import { validate, schemas } from "../../middleware/validate.js";
import commentRoutes from "./comment.routes.js";
import { getCommentCounts } from "./comment.controller.js";

const router = express.Router();
router.use(protect());

// Grid data
router.get("/:id/data", checkSheetPermission("view"), getSheetData);

// Cell operations
router.put("/:id/cells/:cellId", checkSheetPermission("edit"), validate(schemas.updateCell), updateCell);
router.post("/:id/cells", checkSheetPermission("edit"), upsertCell);

// Row management
router.post("/:id/rows", checkSheetPermission("edit"), addRow);
router.delete("/:id/rows/:rowId", protect(["admin", "superadmin"]), deleteRow);
router.patch("/:id/rows/:rowId/order", checkSheetPermission("edit"), reorderRow);
router.patch("/:id/rows/:rowId/color", checkSheetPermission("edit"), updateRowColor);
router.post("/:id/rows/bulk", checkSheetPermission("edit"), bulkInsertRows);

// Comment counts – lightweight map of cellId → count
router.get("/:sheetId/comment-counts", getCommentCounts);

// Comments – nested under sheet + cell
router.use("/:sheetId/cells/:cellId/comments", commentRoutes);

export default router;
