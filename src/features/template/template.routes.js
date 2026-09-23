import express from "express";
import { protect } from "../../middleware/auth.js";
import {
    createTemplate,
    getTemplates,
    updateTemplate,
    deleteTemplate
} from "./template.controller.js";

const router = express.Router();

router.use(protect()); // Require authentication for all template routes

router.post("/", createTemplate);
router.get("/business/:businessId", getTemplates);
router.put("/:id", updateTemplate);
router.delete("/:id", deleteTemplate);

export default router;
