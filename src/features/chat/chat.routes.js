import express from "express";
import { createRoom, listRooms, getMessages, sendMessage } from "./chat.controller.js";
import { protect } from "../../middleware/auth.js";
import { audioUpload } from "../../middleware/audio.upload.js";

const router = express.Router();
router.use(protect());

// ── Chat Rooms ────────────────────────────────────────────────────────────────
router.get("/rooms", listRooms);
router.post("/rooms", protect(["admin", "superadmin"]), createRoom);

// ── Messages ──────────────────────────────────────────────────────────────────
router.get("/rooms/:roomId/messages", getMessages);
router.post("/rooms/:roomId/messages", sendMessage);

// ── Audio message upload in room ──────────────────────────────────────────────
// POST /api/chat/rooms/:roomId/audio
// FormData: audio=<file>  optionally: duration=<seconds>
router.post("/rooms/:roomId/audio", audioUpload.single("audio"), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "Audio file is required" });
        }
        req.body.fileUrl = `/uploads/audio/${req.file.filename}`;
        req.body.fileType = "audio";
        return sendMessage(req, res, next);
    } catch (e) { next(e); }
});

export default router;
