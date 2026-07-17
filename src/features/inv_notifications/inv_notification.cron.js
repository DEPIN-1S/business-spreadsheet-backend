import cron from "node-cron";
import InvCcRow from "../inv_sheet/inv_cc_row.model.js";
import InvCcCell from "../inv_sheet/inv_cc_cell.model.js";
import InvRow from "../inv_sheet/inv_row.model.js";
import InvCell from "../inv_sheet/inv_cell.model.js";
import InvNotification from "./inv_notification.model.js";
import { sendStockAlertEmail } from "../../utils/emailService.js";
import { Op } from "sequelize";

// Helper to get cell value from list of cells
const getCellValue = (cells, colId) => {
    const cell = cells.find(c => c.columnId === colId);
    return cell ? cell.rawValue : "";
};

export const checkInventoryAlerts = async () => {
    console.log("[Inventory Cron] Running daily alert checks...");
    try {
        const batches = await InvCcRow.findAll({
            where: { isDeleted: false },
            include: [
                { model: InvCcCell, as: "cells" },
                {
                    model: InvRow,
                    include: [{ model: InvCell, as: "cells" }]
                }
            ]
        });

        const today = new Date();
        const alertThresholdDate = new Date();
        alertThresholdDate.setDate(today.getDate() + 120);

        for (const batch of batches) {
            const cells = batch.cells || [];
            const parentRow = batch.InvRow; // default relation name for belongsTo(InvRow)
            const parentCells = parentRow ? (parentRow.cells || []) : [];

            const productName = getCellValue(parentCells, "col-product-name") || "Unknown Product";
            const batchName = getCellValue(cells, "col-cc-batch") || "Unknown Batch";
            const qtyStr = getCellValue(cells, "col-cc-quantity-stock");
            const qty = qtyStr === "" ? 0 : parseFloat(qtyStr);
            const notifiedStr = getCellValue(cells, "col-cc-quantity-notified");
            const notifiedQty = notifiedStr === "" ? 0 : parseFloat(notifiedStr);
            const expiryStr = getCellValue(cells, "col-cc-expiry-date");

            // 1. Expiry Check
            if (expiryStr && qty > 0) {
                const expiryDate = new Date(expiryStr);
                if (!isNaN(expiryDate.getTime()) && expiryDate <= alertThresholdDate) {
                    // Check if unread notification already exists
                    const existing = await InvNotification.findOne({
                        where: {
                            invCcRowId: batch.id,
                            type: "expiry_alert",
                            isRead: false,
                            isDismissed: false
                        }
                    });
                    if (!existing) {
                        const daysLeft = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
                        const title = `Expiry Alert: ${productName}`;
                        const message = `Batch "${batchName}" is expiring in ${daysLeft} days (Expiry: ${expiryStr}).`;
                        await InvNotification.create({
                            type: "expiry_alert",
                            title,
                            message,
                            invCcRowId: batch.id,
                            invRowId: parentRow ? parentRow.id : null,
                            productName,
                            batchName,
                            currentQty: qty,
                            expiryDate: expiryStr
                        });
                        sendStockAlertEmail({ type: "expiry_alert", title, message, productName, batchName, currentQty: qty, expiryDate: expiryStr }).catch(err => console.error("[Cron Email Error]", err));
                    }
                }
            }

            // 2. Stock checks
            if (qty <= 0) {
                // Out of stock
                const existing = await InvNotification.findOne({
                    where: {
                        invCcRowId: batch.id,
                        type: "out_of_stock",
                        isRead: false,
                        isDismissed: false
                    }
                });
                if (!existing) {
                    const title = `Out of Stock: ${productName}`;
                    const message = `Batch "${batchName}" is completely out of stock.`;
                    await InvNotification.create({
                        type: "out_of_stock",
                        title,
                        message,
                        invCcRowId: batch.id,
                        invRowId: parentRow ? parentRow.id : null,
                        productName,
                        batchName,
                        currentQty: qty
                    });
                    sendStockAlertEmail({ type: "out_of_stock", title, message, productName, batchName, currentQty: qty }).catch(err => console.error("[Cron Email Error]", err));
                }
            } else if (qty < notifiedQty) {
                // Low stock
                const existing = await InvNotification.findOne({
                    where: {
                        invCcRowId: batch.id,
                        type: "low_stock",
                        isRead: false,
                        isDismissed: false
                    }
                });
                if (!existing) {
                    const title = `Low Stock: ${productName}`;
                    const message = `Batch "${batchName}" has reached low stock level. Current quantity: ${qty} (Threshold: ${notifiedQty}).`;
                    await InvNotification.create({
                        type: "low_stock",
                        title,
                        message,
                        invCcRowId: batch.id,
                        invRowId: parentRow ? parentRow.id : null,
                        productName,
                        batchName,
                        currentQty: qty
                    });
                    sendStockAlertEmail({ type: "low_stock", title, message, productName, batchName, currentQty: qty }).catch(err => console.error("[Cron Email Error]", err));
                }
            }
        }
        console.log("[Inventory Cron] Daily alert checks completed.");
    } catch (e) {
        console.error("[Inventory Cron] Error running checkInventoryAlerts:", e);
    }
};

// Run cron daily at midnight
export const initCron = () => {
    cron.schedule("0 0 * * *", () => {
        checkInventoryAlerts();
    });
};
