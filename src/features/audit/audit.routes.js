import express from "express";
import { getLogs, exportLogs } from "./audit.controller.js";
import { protect } from "../../middleware/auth.js";

const router = express.Router();
router.use(protect(["admin", "superadmin"]));

router.get("/", getLogs);
router.get("/export", exportLogs);

export default router;
