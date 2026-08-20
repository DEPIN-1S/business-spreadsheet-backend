import sequelize from "./config/db.js";
import { checkPendingLedgerAlerts } from "./features/inv_notifications/inv_notification.cron.js";

try {
    await sequelize.authenticate();
    console.log("DB connected OK. Running checkPendingLedgerAlerts()...");

    await checkPendingLedgerAlerts();

    const [notifs] = await sequelize.query(
        "SELECT id, type, title, message, partyName, partyContact, grandTotal, paidAmount, pendingAmount, paymentStatus FROM inv_notifications WHERE type = 'pending_payment_alert'"
    );

    console.log("\n--- Pending Payment Notifications in DB ---");
    console.log(JSON.stringify(notifs, null, 2));

} catch (err) {
    console.error("Test Error:", err);
} finally {
    await sequelize.close();
}
