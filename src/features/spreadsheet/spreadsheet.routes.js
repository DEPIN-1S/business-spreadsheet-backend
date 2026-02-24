import express from "express";
import {
    getSheetData, updateCell, addRow, deleteRow, upsertCell
} from "./spreadsheet.controller.js";
import { protect } from "../../middleware/auth.js";
import { checkSheetPermission } from "../../middleware/rbac.js";
import { validate, schemas } from "../../middleware/validate.js";

const router = express.Router();

// All routes require authentication
router.use(protect());

// Grid data – staff needs view permission
router.get("/:id/data", checkSheetPermission("view"), getSheetData);

// Cell operations – staff needs edit permission
router.put("/:id/cells/:cellId", checkSheetPermission("edit"), validate(schemas.updateCell), updateCell);
router.post("/:id/cells", checkSheetPermission("edit"), upsertCell);

// Row management
router.post("/:id/rows", checkSheetPermission("edit"), addRow);
router.delete("/:id/rows/:rowId", protect(["admin", "superadmin"]), deleteRow);

export default router;
