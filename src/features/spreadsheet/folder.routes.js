import express from "express";
import {
    createFolder, updateFolder, deleteFolder,
    getFolderTree, getFolderChildren, getBreadcrumb,
    setFolderPermission, duplicateFolder
} from "./folder.controller.js";
import { protect } from "../../middleware/auth.js";

const router = express.Router();
router.use(protect());

// Public folder access (filtered by permission inside controller)
router.get("/", getFolderTree);
router.get("/:id/children", getFolderChildren);
router.get("/:id/breadcrumb", getBreadcrumb);

// Authenticated folder management
router.post("/", createFolder);
router.post("/:id/duplicate", duplicateFolder);
router.put("/:id", updateFolder);
router.delete("/:id", deleteFolder);

// Permission management (admin+)
router.post("/:id/permissions", protect(["admin", "superadmin"]), setFolderPermission);

export default router;
