import express from "express";
import {
    createSheet, listSheets, getSheet, updateSheet, deleteSheet, duplicateSheet,
    addColumn, updateColumn, deleteColumn,
    moveColumnLeft, moveColumnRight, reorderColumns,
    toggleColumnHidden, toggleColumnLocked,
    shareSheet, updateShareRole, removeShare, getSharedWithMe, setPermission, listPermissions, getAuditForSheet, listActiveUsers
} from "./admin.controller.js";
import { protect } from "../../middleware/auth.js";
import { validate, schemas } from "../../middleware/validate.js";

const router = express.Router();
router.use(protect(["admin", "superadmin"]));

// Spreadsheet CRUD
router.post("/sheets", validate(schemas.createSheet), createSheet);
router.get("/sheets", listSheets);
router.get("/sheets/:id", getSheet);
router.put("/sheets/:id", updateSheet);
router.delete("/sheets/:id", deleteSheet);
router.post("/sheets/:id/duplicate", duplicateSheet);

// Column management
router.post("/sheets/:id/columns", validate(schemas.createColumn), addColumn);
router.put("/sheets/:id/columns/:colId", updateColumn);
router.delete("/sheets/:id/columns/:colId", deleteColumn);
router.patch("/sheets/:id/columns/:colId/move-left", moveColumnLeft);
router.patch("/sheets/:id/columns/:colId/move-right", moveColumnRight);
router.put("/sheets/:id/columns/reorder", reorderColumns);
router.patch("/sheets/:id/columns/:colId/toggle-hidden", toggleColumnHidden);
router.patch("/sheets/:id/columns/:colId/toggle-locked", toggleColumnLocked);

// Sharing & permissions
router.post("/sheets/:id/share", validate(schemas.shareSheet), shareSheet);
router.post("/sheets/:id/permissions", validate(schemas.permission), setPermission);
router.get("/sheets/:id/permissions", listPermissions);
router.put("/sheets/:id/permissions/:userId", validate(schemas.updateShareRole), updateShareRole);
router.delete("/sheets/:id/permissions/:userId", removeShare);
router.get("/shared-with-me", getSharedWithMe);

// Active users
router.get("/sheets/:id/active-users", listActiveUsers);

// Audit
router.get("/sheets/:id/audit", getAuditForSheet);

export default router;
