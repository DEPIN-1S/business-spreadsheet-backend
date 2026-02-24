import express from "express";
import {
    createSheet, listSheets, getSheet, updateSheet, deleteSheet,
    addColumn, updateColumn, deleteColumn,
    setPermission, listPermissions, getAuditForSheet
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

// Column management
router.post("/sheets/:id/columns", validate(schemas.createColumn), addColumn);
router.put("/sheets/:id/columns/:colId", updateColumn);
router.delete("/sheets/:id/columns/:colId", deleteColumn);

// Permission management
router.post("/sheets/:id/permissions", validate(schemas.permission), setPermission);
router.get("/sheets/:id/permissions", listPermissions);

// Audit
router.get("/sheets/:id/audit", getAuditForSheet);

export default router;
