import express from "express";
import { protect } from "../../middleware/auth.js";
import {
    listNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    triggerAlertChecks,
    testEmailNotification
} from "./inv_notification.controller.js";

const router = express.Router();
router.use(protect());

router.get("/", listNotifications);
router.get("/count", getUnreadCount);
router.post("/trigger", triggerAlertChecks);
router.post("/test-email", testEmailNotification);
router.patch("/read-all", markAllAsRead);
router.patch("/:id/read", markAsRead);
router.patch("/:id/dismiss", dismissNotification);

export default router;
