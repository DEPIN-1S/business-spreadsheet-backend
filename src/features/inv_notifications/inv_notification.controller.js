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

export const testEmailNotification = async (req, res, next) => {
    try {
        const { type = "all", recipientEmail } = req.body;
        const { sendNewProductEmail, sendPendingPaymentEmail } = await import("../../utils/emailService.js");
        const to = recipientEmail || process.env.ALERT_EMAIL_RECIPIENT || "sdepin4@gmail.com";

        const results = {};

        if (type === "product" || type === "all") {
            results.newProduct = await sendNewProductEmail({
                productName: "Dapasug VD Tab 10mg",
                rackNo: "A-01",
                batchName: "BTH-9941",
                initialQty: 500,
                purchaseRate: 14.50,
                mrp: 28.00,
                recipientEmail: to
            });
        }

        if (type === "partially_paid" || type === "all") {
            results.partiallyPaid = await sendPendingPaymentEmail({
                invoiceNo: "INV-WH-2026-009",
                partyName: "Sankers Drugs & Surgicals",
                partyContact: "+91 98765 43210",
                invoiceDate: new Date().toISOString().split("T")[0],
                paymentStatus: "Partially Paid",
                grandTotal: 5000.00,
                paidAmount: 3000.00,
                pendingAmount: 2000.00,
                recipientEmail: to
            });
        }

        if (type === "unpaid" || type === "all") {
            results.unpaid = await sendPendingPaymentEmail({
                invoiceNo: "INV-RET-2026-022",
                partyName: "Apex Medicare",
                partyContact: "+91 91234 56789",
                invoiceDate: new Date().toISOString().split("T")[0],
                paymentStatus: "Unpaid",
                grandTotal: 1850.00,
                paidAmount: 0.00,
                pendingAmount: 1850.00,
                recipientEmail: to
            });
        }

        res.json({
            message: `SMTP test emails dispatched to ${to}`,
            recipient: to,
            results
        });
    } catch (e) {
        next(e);
    }
};
