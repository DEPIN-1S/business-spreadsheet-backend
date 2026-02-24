import express from "express";
import { createRoom, listRooms, getMessages, sendMessage } from "./chat.controller.js";
import { protect } from "../../middleware/auth.js";

const router = express.Router();
router.use(protect());

router.get("/rooms", listRooms);
router.post("/rooms", protect(["admin", "superadmin"]), createRoom);
router.get("/rooms/:roomId/messages", getMessages);
router.post("/rooms/:roomId/messages", sendMessage);

export default router;
