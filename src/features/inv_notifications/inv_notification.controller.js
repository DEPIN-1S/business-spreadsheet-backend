import InvNotification from "./inv_notification.model.js";
import AppError from "../../utils/AppError.js";

export const listNotifications = async (req, res, next) => {
    try {
        const where = { isDismissed: false };
        if (req.query.isRead !== undefined) {
            where.isRead = req.query.isRead === "true";
        }
        if (req.query.type) {
            where.type = req.query.type;
        }
        const notifications = await InvNotification.findAll({
            where,
            order: [["createdAt", "DESC"]]
        });
        res.json({ data: notifications });
    } catch (e) { next(e); }
};

export const getUnreadCount = async (req, res, next) => {
    try {
        const count = await InvNotification.count({
            where: { isRead: false, isDismissed: false }
        });
        res.json({ data: { count } });
    } catch (e) { next(e); }
};

export const markAsRead = async (req, res, next) => {
    try {
        const notification = await InvNotification.findByPk(req.params.id);
        if (!notification) throw new AppError("Notification not found", 404);
        await notification.update({ isRead: true });
        res.json({ data: notification, message: "Marked as read" });
    } catch (e) { next(e); }
};

export const markAllAsRead = async (req, res, next) => {
    try {
        await InvNotification.update(
            { isRead: true },
            { where: { isRead: false, isDismissed: false } }
        );
        res.json({ message: "All notifications marked as read" });
    } catch (e) { next(e); }
};

export const dismissNotification = async (req, res, next) => {
    try {
        const notification = await InvNotification.findByPk(req.params.id);
        if (!notification) throw new AppError("Notification not found", 404);
        await notification.update({ isDismissed: true, isRead: true });
        res.json({ message: "Notification dismissed" });
    } catch (e) { next(e); }
};

export const triggerAlertChecks = async (req, res, next) => {
    try {
        const { checkInventoryAlerts, checkPendingLedgerAlerts } = await import("./inv_notification.cron.js");
        await checkInventoryAlerts();
        await checkPendingLedgerAlerts();
        res.json({ message: "Alert checks completed successfully" });
    } catch (e) { next(e); }
};
