import sequelize from "../../config/db.js";
import RetailParty from "./retail_party.model.js";
import WholesaleParty from "./wholesale_party.model.js";
import Invoice from "./invoice.model.js";
import InvoiceItem from "./invoice_item.model.js";
import LedgerEntry from "./ledger.model.js";
import InvCcCell from "../inv_sheet/inv_cc_cell.model.js";
import InvCcRow from "../inv_sheet/inv_cc_row.model.js";
import InvRow from "../inv_sheet/inv_row.model.js";
import InvCell from "../inv_sheet/inv_cell.model.js";
import InvNotification from "../inv_notifications/inv_notification.model.js";
import { sendStockAlertEmail } from "../../utils/emailService.js";
import AppError from "../../utils/AppError.js";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS FOR STOCK RESTORATION & STATUS UPDATE
// ─────────────────────────────────────────────────────────────────────────────

async function autoUpdateBatchStatus(ccRowId, currentQty, transaction) {
    const notifiedCell = await InvCcCell.findOne({
        where: { ccRowId, columnId: "col-cc-quantity-notified" },
        transaction
    });
    const notifiedQty = parseFloat(notifiedCell?.rawValue || 0);

    const status =
        currentQty <= 0          ? "Out of Stock" :
        currentQty < notifiedQty ? "Low Stock"    :
                                   "Stock Available";

    await InvCcCell.upsert({
        ccRowId, columnId: "col-cc-status", rawValue: status
    }, { transaction });

    // Also trigger/update notification
    if (status === "Out of Stock" || status === "Low Stock") {
        const ccRow = await InvCcRow.findByPk(ccRowId, {
            include: [
                { model: InvCcCell, as: "cells" },
                {
                    model: InvRow,
                    include: [{ model: InvCell, as: "cells" }]
                }
            ],
            transaction
        });
        if (ccRow) {
            const cells = ccRow.cells || [];
            const parentRow = ccRow.InvRow;
            const parentCells = parentRow ? (parentRow.cells || []) : [];
            const getVal = (list, colId) => {
                const cell = list.find(c => c.columnId === colId);
                return cell ? cell.rawValue : "";
            };
            const productName = getVal(parentCells, "col-product-name") || "Unknown Product";
            const batchName = getVal(cells, "col-cc-batch") || "Unknown Batch";
            const type = status === "Out of Stock" ? "out_of_stock" : "low_stock";
            const title = status === "Out of Stock" ? `Out of Stock: ${productName}` : `Low Stock: ${productName}`;
            const message = status === "Out of Stock"
                ? `Batch "${batchName}" is completely out of stock.`
                : `Batch "${batchName}" has reached low stock level. Current quantity: ${currentQty} (Threshold: ${notifiedQty}).`;

            const existing = await InvNotification.findOne({
                where: { invCcRowId: ccRowId, type, isRead: false, isDismissed: false },
                transaction
            });
            if (!existing) {
                await InvNotification.create({
                    type,
                    title,
                    message,
                    invCcRowId: ccRowId,
                    invRowId: parentRow ? parentRow.id : null,
                    productName,
                    batchName,
                    currentQty
                }, { transaction });

                // Dispatch SMTP email alert asynchronously
                sendStockAlertEmail({
                    type,
                    title,
                    message,
                    productName,
                    batchName,
                    currentQty
                }).catch(err => console.error("[EmailService Error]", err));
            }
        }
    }
}

async function adjustBatchStock(ccRowId, qtyDelta, transaction) {
    const stockCell = await InvCcCell.findOne({
        where: { ccRowId, columnId: "col-cc-quantity-stock" },
        transaction
    });
    if (!stockCell) return;
    const currentQty = parseFloat(stockCell.rawValue || 0);
    const newQty = Math.max(0, currentQty + qtyDelta);
    await stockCell.update({ rawValue: String(newQty) }, { transaction });
    await autoUpdateBatchStatus(ccRowId, newQty, transaction);

    // Sync parent product row main cell "col-retail-inventory"
    const ccRow = await InvCcRow.findOne({
        where: { id: ccRowId },
        transaction
    });
    if (ccRow && ccRow.parentRowId) {
        const parentRowId = ccRow.parentRowId;
        const allCcRows = await InvCcRow.findAll({
            where: { parentRowId, isDeleted: false },
            transaction
        });
        const ccRowIds = allCcRows.map(r => r.id);
        const allStockCells = await InvCcCell.findAll({
            where: {
                ccRowId: ccRowIds,
                columnId: "col-cc-quantity-stock"
            },
            transaction
        });
        let totalStock = 0;
        for (const cell of allStockCells) {
            totalStock += parseFloat(cell.rawValue || 0);
        }

        const mainInventoryCell = await InvCell.findOne({
            where: { rowId: parentRowId, columnId: "col-retail-inventory" },
            transaction
        });
        if (mainInventoryCell) {
            await mainInventoryCell.update({ rawValue: String(totalStock) }, { transaction });
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PARTIES
// ─────────────────────────────────────────────────────────────────────────────

const getPartyModel = (type) => {
    if (type === "retail") return RetailParty;
    if (type === "wholesale") return WholesaleParty;
    throw new AppError(`Unknown party type: ${type}`, 400);
};

export const listParties = async (req, res, next) => {
    try {
        const Model = getPartyModel(req.params.type);
        const parties = await Model.findAll({ where: { isDeleted: false }, order: [["name", "ASC"]] });
        res.json({ data: parties });
    } catch (e) { next(e); }
};

export const createParty = async (req, res, next) => {
    try {
        const Model = getPartyModel(req.params.type);
        const { name, contact, email, address, registrationNo } = req.body;
        if (!name?.trim()) throw new AppError("Party name is required", 422);
        const party = await Model.create({ name: name.trim(), contact, email, address, registrationNo });
        res.status(201).json({ data: party, message: "Party created" });
    } catch (e) { next(e); }
};

export const updateParty = async (req, res, next) => {
    try {
        const Model = getPartyModel(req.params.type);
        const party = await Model.findOne({ where: { id: req.params.id, isDeleted: false } });
        if (!party) throw new AppError("Party not found", 404);
        await party.update(req.body);
        res.json({ data: party, message: "Party updated" });
    } catch (e) { next(e); }
};

export const deleteParty = async (req, res, next) => {
    try {
        const Model = getPartyModel(req.params.type);
        const party = await Model.findOne({ where: { id: req.params.id, isDeleted: false } });
        if (!party) throw new AppError("Party not found", 404);
        await party.update({ isDeleted: true });
        res.json({ message: "Party deleted" });
    } catch (e) { next(e); }
};

// ─────────────────────────────────────────────────────────────────────────────
// INVOICES
// ─────────────────────────────────────────────────────────────────────────────

const generateInvoiceNo = async (type) => {
    const prefix = type === "retail" ? "INV-RET" : "INV-WH";
    const year = new Date().getFullYear();
    const count = await Invoice.count({ where: { type } });
    const seq = String(count + 1).padStart(3, "0");
    return `${prefix}-${year}-${seq}`;
};

export const listInvoices = async (req, res, next) => {
    try {
        const where = { isDeleted: false };
        if (req.query.type && ["retail", "wholesale"].includes(req.query.type)) {
            where.type = req.query.type;
        }
        const invoices = await Invoice.findAll({
            where,
            include: [{ model: InvoiceItem, as: "items", where: { isDeleted: false }, required: false }],
            order: [["createdAt", "DESC"]]
        });
        res.json({ data: invoices });
    } catch (e) { next(e); }
};

export const createInvoice = async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
        const {
            type, partyId, partyType, partyName, invoiceDate,
            items = [], subtotal, taxAmount, grandTotal,
            paymentMethod, paymentStatus, pendingAmount,
            combinedUpiAmount, combinedCashAmount, notes
        } = req.body;

        if (!type || !["retail", "wholesale"].includes(type)) throw new AppError("type must be 'retail' or 'wholesale'", 422);
        if (!invoiceDate) throw new AppError("invoiceDate is required", 422);

        const invoiceNo = await generateInvoiceNo(type);

        const invoice = await Invoice.create({
            invoiceNo, type, partyId, partyType, partyName,
            invoiceDate, subtotal: subtotal || 0,
            taxAmount: taxAmount || 0, grandTotal: grandTotal || 0,
            paymentMethod, paymentStatus: paymentStatus || "Unpaid",
            pendingAmount: pendingAmount || 0,
            combinedUpiAmount: combinedUpiAmount || 0,
            combinedCashAmount: combinedCashAmount || 0,
            notes, createdBy: req.user?.id || null
        }, { transaction: t });

        if (items.length > 0) {
            const itemRows = items.map(item => ({
                invoiceId: invoice.id,
                invCcRowId: item.invCcRowId || null,
                description: item.description,
                batch: item.batch,
                qty: item.qty || 0,
                price: item.price || 0,
                isDeleted: false
            }));
            await InvoiceItem.bulkCreate(itemRows, { transaction: t });

            for (const item of items) {
                if (item.invCcRowId) {
                    await adjustBatchStock(item.invCcRowId, -parseFloat(item.qty || 0), t);
                }
            }
        }

        if (paymentStatus !== "Paid") {
            await LedgerEntry.create({
                invoiceId: invoice.id,
                invoiceNo,
                type: type === "retail" ? "Retail" : "Wholesale",
                customerName: partyName || "",
                phone: "",
                date: invoiceDate,
                pendingAmount: pendingAmount || grandTotal || 0,
                status: paymentStatus === "Partially Paid" ? "Partially Paid" : "Pending"
            }, { transaction: t });
        }

        await t.commit();
        const fullInvoice = await Invoice.findByPk(invoice.id, {
            include: [{ model: InvoiceItem, as: "items" }]
        });
        res.status(201).json({ data: fullInvoice, message: "Invoice created", invoiceNo });
    } catch (e) {
        await t.rollback();
        next(e);
    }
};

export const getInvoice = async (req, res, next) => {
    try {
        const invoice = await Invoice.findOne({
            where: { id: req.params.id, isDeleted: false },
            include: [{ model: InvoiceItem, as: "items", where: { isDeleted: false }, required: false }]
        });
        if (!invoice) throw new AppError("Invoice not found", 404);
        res.json({ data: invoice });
    } catch (e) { next(e); }
};

export const updateInvoice = async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
        const invoice = await Invoice.findOne({
            where: { id: req.params.id, isDeleted: false },
            include: [{ model: InvoiceItem, as: "items", where: { isDeleted: false }, required: false }],
            transaction: t
        });
        if (!invoice) throw new AppError("Invoice not found", 404);

        const {
            partyId, partyType, partyName, invoiceDate,
            items, subtotal, taxAmount, grandTotal,
            paymentMethod, paymentStatus, pendingAmount,
            combinedUpiAmount, combinedCashAmount, notes
        } = req.body;

        const oldItems = invoice.items || [];
        for (const oldItem of oldItems) {
            if (oldItem.invCcRowId) {
                await adjustBatchStock(oldItem.invCcRowId, parseFloat(oldItem.qty || 0), t);
            }
        }

        if (items !== undefined) {
            await InvoiceItem.destroy({ where: { invoiceId: invoice.id }, transaction: t });

            if (items && items.length > 0) {
                const itemRows = items.map(item => ({
                    invoiceId: invoice.id,
                    invCcRowId: item.invCcRowId || null,
                    description: item.description,
                    batch: item.batch,
                    qty: item.qty || 0,
                    price: item.price || 0,
                    isDeleted: false
                }));
                await InvoiceItem.bulkCreate(itemRows, { transaction: t });

                for (const item of items) {
                    if (item.invCcRowId) {
                        await adjustBatchStock(item.invCcRowId, -parseFloat(item.qty || 0), t);
                    }
                }
            }
        }

        await invoice.update({
            partyId: partyId !== undefined ? partyId : invoice.partyId,
            partyType: partyType !== undefined ? partyType : invoice.partyType,
            partyName: partyName !== undefined ? partyName : invoice.partyName,
            invoiceDate: invoiceDate !== undefined ? invoiceDate : invoice.invoiceDate,
            subtotal: subtotal !== undefined ? subtotal : invoice.subtotal,
            taxAmount: taxAmount !== undefined ? taxAmount : invoice.taxAmount,
            grandTotal: grandTotal !== undefined ? grandTotal : invoice.grandTotal,
            paymentMethod: paymentMethod !== undefined ? paymentMethod : invoice.paymentMethod,
            paymentStatus: paymentStatus !== undefined ? paymentStatus : invoice.paymentStatus,
            pendingAmount: pendingAmount !== undefined ? pendingAmount : invoice.pendingAmount,
            combinedUpiAmount: combinedUpiAmount !== undefined ? combinedUpiAmount : invoice.combinedUpiAmount,
            combinedCashAmount: combinedCashAmount !== undefined ? combinedCashAmount : invoice.combinedCashAmount,
            notes: notes !== undefined ? notes : invoice.notes
        }, { transaction: t });

        const newGrandTotal = grandTotal !== undefined ? grandTotal : invoice.grandTotal;
        const newPendingAmount = pendingAmount !== undefined ? pendingAmount : invoice.pendingAmount;
        const newPaymentStatus = paymentStatus !== undefined ? paymentStatus : invoice.paymentStatus;

        if (newPaymentStatus === "Paid") {
            await LedgerEntry.destroy({ where: { invoiceId: invoice.id }, transaction: t });
        } else {
            const ledgerStatus = newPaymentStatus === "Partially Paid" ? "Partially Paid" : "Pending";
            const [ledger, created] = await LedgerEntry.findOrCreate({
                where: { invoiceId: invoice.id },
                defaults: {
                    invoiceNo: invoice.invoiceNo,
                    type: invoice.type === "retail" ? "Retail" : "Wholesale",
                    customerName: partyName || invoice.partyName || "",
                    phone: "",
                    date: invoiceDate || invoice.invoiceDate,
                    pendingAmount: newPendingAmount || newGrandTotal || 0,
                    status: ledgerStatus
                },
                transaction: t
            });
            if (!created) {
                await ledger.update({
                    customerName: partyName || invoice.partyName || "",
                    date: invoiceDate || invoice.invoiceDate,
                    pendingAmount: newPendingAmount || newGrandTotal || 0,
                    status: ledgerStatus
                }, { transaction: t });
            }
        }

        await t.commit();
        const updatedInvoice = await Invoice.findByPk(invoice.id, {
            include: [{ model: InvoiceItem, as: "items" }]
        });
        res.json({ data: updatedInvoice, message: "Invoice updated successfully" });
    } catch (e) {
        await t.rollback();
        next(e);
    }
};

export const deleteInvoice = async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
        const invoice = await Invoice.findOne({
            where: { id: req.params.id, isDeleted: false },
            include: [{ model: InvoiceItem, as: "items", where: { isDeleted: false }, required: false }],
            transaction: t
        });
        if (!invoice) throw new AppError("Invoice not found", 404);

        await invoice.update({ isDeleted: true }, { transaction: t });
        await InvoiceItem.update(
            { isDeleted: true },
            { where: { invoiceId: invoice.id }, transaction: t }
        );

        const items = invoice.items || [];
        for (const item of items) {
            if (item.invCcRowId) {
                await adjustBatchStock(item.invCcRowId, parseFloat(item.qty || 0), t);
            }
        }

        await LedgerEntry.update(
            { isDeleted: true },
            { where: { invoiceId: invoice.id }, transaction: t }
        );

        await t.commit();
        res.json({ message: "Invoice deleted and stock restored" });
    } catch (e) {
        await t.rollback();
        next(e);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// LEDGER
// ─────────────────────────────────────────────────────────────────────────────

export const listLedger = async (req, res, next) => {
    try {
        const where = { isDeleted: false };
        if (req.query.type) where.type = req.query.type;
        const entries = await LedgerEntry.findAll({ where, order: [["createdAt", "DESC"]] });
        res.json({ data: entries });
    } catch (e) { next(e); }
};

export const updateLedger = async (req, res, next) => {
    try {
        const entry = await LedgerEntry.findOne({ where: { id: req.params.id, isDeleted: false } });
        if (!entry) throw new AppError("Ledger entry not found", 404);
        const { status, pendingAmount } = req.body;
        await entry.update({
            ...(status ? { status } : {}),
            ...(pendingAmount !== undefined ? { pendingAmount } : {})
        });
        if (status === "Settled" && entry.invoiceId) {
            await Invoice.update({ paymentStatus: "Paid", pendingAmount: 0 }, { where: { id: entry.invoiceId } });
        }
        res.json({ data: entry, message: "Ledger updated" });
    } catch (e) { next(e); }
};
