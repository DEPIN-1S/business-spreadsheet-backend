import express from "express";
import { addComment, listComments, editComment, deleteComment } from "./comment.controller.js";
import { protect } from "../../middleware/auth.js";

const router = express.Router({ mergeParams: true }); // inherits :sheetId from parent
router.use(protect());

router.post("/", addComment);
router.get("/", listComments);
router.put("/:commentId", editComment);
router.delete("/:commentId", deleteComment);

export default router;
