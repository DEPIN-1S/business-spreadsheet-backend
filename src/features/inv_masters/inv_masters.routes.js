import express from "express";
import { listMasterOptions, addMasterOption, deleteMasterOption } from "./inv_masters.controller.js";
import { protect } from "../../middleware/auth.js";

const router = express.Router();
router.use(protect(["superadmin"]));

// GET  /api/inv/masters/:type        → list options (gst, categories, divisions, manufacturers, companies, quantity-units)
// POST /api/inv/masters/:type        → add new option
// DELETE /api/inv/masters/:type/:id  → deactivate option
router.get("/:type", listMasterOptions);
router.post("/:type", addMasterOption);
router.delete("/:type/:id", deleteMasterOption);

export default router;
