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

// Active users
router.get("/sheets/:id/active-users", listActiveUsers);

// Audit
router.get("/sheets/:id/audit", getAuditForSheet);

export default router;
