import express from "express";
import { uploadFile, uploadMultipleFiles, getFile, deleteFile, listFiles } from "./media.controller.js";
import { protect } from "../../middleware/auth.js";
import { upload } from "../../middleware/upload.js";

const router = express.Router();
router.use(protect());

router.post("/upload", upload.single("file"), uploadFile);
router.post("/upload-multiple", upload.array("files", 20), uploadMultipleFiles);
router.get("/", listFiles);
router.get("/:id", getFile);
router.delete("/:id", deleteFile);

export default router;
