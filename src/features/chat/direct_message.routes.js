import express from "express";
import {
    sendDirectMessage, getConversation, getInbox,
    deleteDirectMessage, markAsRead, sendAudioMessage, sendFileMessage
} from "./direct_message.controller.js";
import { protect } from "../../middleware/auth.js";
import { audioUpload } from "../../middleware/audio.upload.js";
import { fileUpload } from "../../middleware/file.upload.js";

const router = express.Router();
router.use(protect());

// ── Inbox ─────────────────────────────────────────────────────────────────────
// GET /api/dm/inbox  → list all conversations with latest message + unread count
router.get("/inbox", getInbox);

// ── Conversation with a specific user ────────────────────────────────────────
// GET  /api/dm/:userId          → full message history
// POST /api/dm/:userId          → send text/file message
// PUT  /api/dm/:userId/read     → mark all messages from that user as read
router.get("/:userId", getConversation);
router.post("/:userId", sendDirectMessage);
router.put("/:userId/read", markAsRead);

// ── Audio message upload ──────────────────────────────────────────────────────
// POST /api/dm/:userId/audio   → upload voice note + save as DM
router.post("/:userId/audio", audioUpload.single("audio"), sendAudioMessage);

// ── File/Image message upload ─────────────────────────────────────────────────
// POST /api/dm/:userId/file    → upload image or PDF + save as DM
router.post("/:userId/file", fileUpload.single("file"), sendFileMessage);

// ── Delete a message ──────────────────────────────────────────────────────────
// DELETE /api/dm/messages/:messageId
router.delete("/messages/:messageId", deleteDirectMessage);

export default router;
