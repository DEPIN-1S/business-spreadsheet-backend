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

            // 1. Expiry Check (Disabled per user request: only stock alerts are tracked)

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
                    const title = `Out of Stock (0 Left): ${productName}`;
                    const message = `Batch "${batchName}" is completely out of stock (0 units remaining).`;
                    await InvNotification.create({
                        type: "out_of_stock",
                        title,
                        message,
                        invCcRowId: batch.id,
                        invRowId: parentRow ? parentRow.id : null,
                        productName,
                        batchName,
                        currentQty: 0
                    });
                    sendStockAlertEmail({ type: "out_of_stock", title, message, productName, batchName, currentQty: 0 }).catch(err => console.error("[Cron Email Error]", err));
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
                    const title = `Low Stock (${qty} Left): ${productName}`;
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
