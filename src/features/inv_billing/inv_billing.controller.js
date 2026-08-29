import { Op } from "sequelize";
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
import { sendStockAlertEmail, sendPendingPaymentEmail } from "../../utils/emailService.js";
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

    // Reset notified status if stock replenished
    if (currentQty > 10) {
        const notifiedResetCell = await InvCcCell.findOne({
            where: { ccRowId, columnId: "col-cc-notified" },
            transaction
        });
        if (notifiedResetCell) {
            await notifiedResetCell.update({ rawValue: "false" }, { transaction });
        }
    }

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
            const title = status === "Out of Stock" ? `Out of Stock (0 Left): ${productName}` : `Low Stock (${currentQty} Left): ${productName}`;
            const message = status === "Out of Stock"
                ? `Batch "${batchName}" is completely out of stock (0 units remaining).`
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
    await stockCell.update({ rawValue: String(newQty), computedValue: String(newQty) }, { transaction });
    await autoUpdateBatchStatus(ccRowId, newQty, transaction);

    // Sync parent product row main cell
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
            await mainInventoryCell.update({ rawValue: String(totalStock), computedValue: String(totalStock) }, { transaction });
        } else {
            await InvCell.create({
                rowId: parentRowId,
                columnId: "col-retail-inventory",
                rawValue: String(totalStock),
                computedValue: String(totalStock)
            }, { transaction });
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
        const where = { isDeleted: false };
        const parties = await Model.findAll({ where, order: [["name", "ASC"]] });
        res.json({ data: parties });
    } catch (e) { next(e); }
};

export const createParty = async (req, res, next) => {
    try {
        const Model = getPartyModel(req.params.type);
        const { name, contact, email, address, billingAddress, shippingAddress, registrationNo, dlNo, gstinNo, panNo, dobYear, age } = req.body;
        if (!name?.trim()) throw new AppError("Party name is required", 422);

        const parts = [];
        if (dlNo?.trim()) parts.push(`DL: ${dlNo.trim()}`);
        if (gstinNo?.trim()) parts.push(`GSTIN: ${gstinNo.trim()}`);
        if (panNo?.trim()) parts.push(`PAN: ${panNo.trim()}`);
        const computedRegNo = parts.length > 0 ? parts.join(', ') : (registrationNo || null);

        const currentYear = new Date().getFullYear();
        const computedAge = dobYear && !isNaN(Number(dobYear)) && Number(dobYear) > 1900
            ? (currentYear - Number(dobYear) + 1)
            : (age ? Number(age) : null);

        // billingAddress takes priority; fall back to legacy address field
        const effectiveBillingAddress = billingAddress ? String(billingAddress).trim() : (address ? String(address).trim() : null);
        const effectiveShippingAddress = shippingAddress ? String(shippingAddress).trim() : effectiveBillingAddress;

        const party = await Model.create({
            name: name.trim(),
            contact: contact ? String(contact).trim() : null,
            email: email ? String(email).trim() : null,
            address: effectiveBillingAddress,               // legacy compat
            billingAddress: effectiveBillingAddress,
            shippingAddress: effectiveShippingAddress,
            registrationNo: computedRegNo,
            dlNo: dlNo ? String(dlNo).trim() : null,
            gstinNo: gstinNo ? String(gstinNo).trim() : null,
            panNo: panNo ? String(panNo).trim() : null,
            dobYear: dobYear ? Number(dobYear) : null,
            age: computedAge,
            createdBy: req.user?.id || null
        });
        res.status(201).json({ data: party, message: "Party created successfully" });
    } catch (e) { next(e); }
};

export const updateParty = async (req, res, next) => {
    try {
        const Model = getPartyModel(req.params.type);
        const party = await Model.findOne({ where: { id: req.params.id, isDeleted: false } });
        if (!party) throw new AppError("Party not found", 404);

        const { name, contact, email, address, billingAddress, shippingAddress, registrationNo, dlNo, gstinNo, panNo, dobYear, age } = req.body;
        if (name !== undefined && !name?.trim()) throw new AppError("Party name is required", 422);

        const parts = [];
        const finalDlNo = dlNo !== undefined ? dlNo : party.dlNo;
        const finalGstinNo = gstinNo !== undefined ? gstinNo : party.gstinNo;
        const finalPanNo = panNo !== undefined ? panNo : party.panNo;
        if (finalDlNo?.trim()) parts.push(`DL: ${finalDlNo.trim()}`);
        if (finalGstinNo?.trim()) parts.push(`GSTIN: ${finalGstinNo.trim()}`);
        if (finalPanNo?.trim()) parts.push(`PAN: ${finalPanNo.trim()}`);
        const computedRegNo = parts.length > 0 ? parts.join(', ') : (registrationNo || party.registrationNo);

        const currentYear = new Date().getFullYear();
        const finalDobYear = dobYear !== undefined ? dobYear : party.dobYear;
        const finalAge = age !== undefined ? age : party.age;
        const computedAge = finalDobYear && !isNaN(Number(finalDobYear)) && Number(finalDobYear) > 1900
            ? (currentYear - Number(finalDobYear) + 1)
            : (finalAge ? Number(finalAge) : null);

        // Resolve effective billing/shipping from new or existing values
        const effectiveBillingAddress = billingAddress !== undefined
            ? (billingAddress ? String(billingAddress).trim() : null)
            : (address !== undefined ? (address ? String(address).trim() : null) : party.billingAddress);
        const effectiveShippingAddress = shippingAddress !== undefined
            ? (shippingAddress ? String(shippingAddress).trim() : null)
            : party.shippingAddress;

        await party.update({
            ...(name !== undefined && { name: name.trim() }),
            ...(contact !== undefined && { contact: contact ? String(contact).trim() : null }),
            ...(email !== undefined && { email: email ? String(email).trim() : null }),
            address: effectiveBillingAddress,               // legacy compat
            billingAddress: effectiveBillingAddress,
            shippingAddress: effectiveShippingAddress,
            registrationNo: computedRegNo || null,
            ...(dlNo !== undefined && { dlNo: dlNo ? String(dlNo).trim() : null }),
            ...(gstinNo !== undefined && { gstinNo: gstinNo ? String(gstinNo).trim() : null }),
            ...(panNo !== undefined && { panNo: panNo ? String(panNo).trim() : null }),
            ...(dobYear !== undefined && { dobYear: dobYear ? Number(dobYear) : null }),
            age: computedAge
        });
        res.json({ data: party, message: "Party updated successfully" });
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

const generateInvoiceNo = async (type, transaction) => {
    const prefix = type === "retail" ? "INV-RET" : "INV-WH";
    const year = new Date().getFullYear();

    const allInvoices = await Invoice.findAll({
        where: { type },
        attributes: ["invoiceNo"],
        transaction
    });

    let maxSeq = 0;
    for (const inv of allInvoices) {
        if (inv.invoiceNo) {
            const parts = inv.invoiceNo.split("-");
            const seqNum = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(seqNum) && seqNum > maxSeq) {
                maxSeq = seqNum;
            }
        }
    }

    let nextNum = maxSeq + 1;
    let seq = String(nextNum).padStart(3, "0");
    let candidate = `${prefix}-${year}-${seq}`;

    let exists = await Invoice.findOne({ where: { invoiceNo: candidate }, transaction });
    while (exists) {
        nextNum += 1;
        seq = String(nextNum).padStart(3, "0");
        candidate = `${prefix}-${year}-${seq}`;
        exists = await Invoice.findOne({ where: { invoiceNo: candidate }, transaction });
    }
    return candidate;
};

export const listInvoices = async (req, res, next) => {
    try {
        const where = { isDeleted: false };
        if (req.query.type && ["retail", "wholesale"].includes(req.query.type)) {
            where.type = req.query.type;
        }
        let invoices = [];
        try {
            invoices = await Invoice.findAll({
                where,
                include: [{ model: InvoiceItem, as: "items", where: { isDeleted: false }, required: false }],
                order: [["createdAt", "DESC"]]
            });
        } catch (err) {
            console.warn("Falling back to basic invoice query without items include:", err.message);
            invoices = await Invoice.findAll({
                where,
                order: [["createdAt", "DESC"]]
            });
        }
        res.json({ data: invoices });
    } catch (e) { next(e); }
};

export const createInvoice = async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
        const {
            type, partyId, partyType, partyName, billingAddress, shippingAddress, invoiceDate,
            items = [], subtotal, taxAmount, grandTotal,
            itemSubtotal, discountAmount, additionalChargesAmount, additionalCharges, roundOffAmount,
            paymentMethod, paymentStatus, pendingAmount,
            combinedUpiAmount, combinedCashAmount, notes
        } = req.body;

        if (!type || !["retail", "wholesale"].includes(type)) throw new AppError("type must be 'retail' or 'wholesale'", 422);
        if (!invoiceDate) throw new AppError("invoiceDate is required", 422);

        const invoiceNo = await generateInvoiceNo(type, t);

        const invoice = await Invoice.create({
            invoiceNo, type, partyId, partyType, partyName,
            billingAddress: billingAddress || null,
            shippingAddress: shippingAddress || null,
            invoiceDate, subtotal: subtotal || 0,
            taxAmount: taxAmount || 0, grandTotal: grandTotal || 0,
            itemSubtotal: itemSubtotal || 0,
            discountAmount: discountAmount || 0,
            additionalChargesAmount: additionalChargesAmount || 0,
            additionalCharges: additionalCharges || null,
            roundOffAmount: roundOffAmount || 0,
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
                mrp: item.mrp || 0,
                gstPercent: item.gstPercent || item.gst || 5,
                disPercent: item.disPercent || item.marginPercent || item.discount || 0,
                expiry: item.expiry || item.expDate || '',
                hsnCode: item.hsnCode || item.hsn || '',
                isDeleted: false
            }));
            await InvoiceItem.bulkCreate(itemRows, { transaction: t });

            for (const item of items) {
                if (item.invCcRowId) {
                    await adjustBatchStock(item.invCcRowId, -parseFloat(item.qty || 0), t);
                }
            }
        }

        const ledgerStatus = paymentStatus === "Paid" ? "Settled" : (paymentStatus === "Partially Paid" ? "Partially Paid" : "Pending");
        const ledgerPending = paymentStatus === "Paid" ? 0 : (pendingAmount !== undefined ? pendingAmount : grandTotal || 0);

        await LedgerEntry.create({
            invoiceId: invoice.id,
            invoiceNo,
            type: type === "retail" ? "Retail" : "Wholesale",
            customerName: partyName || "",
            phone: "",
            date: invoiceDate,
            pendingAmount: ledgerPending,
            status: ledgerStatus,
            createdBy: req.user?.id || null
        }, { transaction: t });

        await t.commit();

        if (["Unpaid", "Partially Paid"].includes(paymentStatus) || ledgerPending > 0) {
            sendPendingPaymentEmail({
                invoiceNo,
                partyName: partyName || "Walk-in Customer",
                partyContact: "",
                partyEmail: "",
                invoiceDate,
                paymentStatus: paymentStatus || "Unpaid",
                grandTotal: grandTotal || 0,
                paidAmount: Math.max(0, (grandTotal || 0) - ledgerPending),
                pendingAmount: ledgerPending
            }).catch(err => console.error("[Auto Pending Payment Email Error]", err));
        }

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
        let invoice;
        try {
            invoice = await Invoice.findOne({
                where: { id: req.params.id, isDeleted: false },
                include: [{ model: InvoiceItem, as: "items", where: { isDeleted: false }, required: false }]
            });
        } catch (err) {
            console.warn("Falling back to basic getInvoice query without items include:", err.message);
            invoice = await Invoice.findOne({
                where: { id: req.params.id, isDeleted: false }
            });
        }
        if (!invoice) throw new AppError("Invoice not found", 404);

        const plainInvoice = invoice.get({ plain: true });

        // Backfill MRP and Discount/Margin from inventory for items
        if (Array.isArray(plainInvoice.items)) {
            for (const item of plainInvoice.items) {
                // Backfill MRP
                if ((!item.mrp || parseFloat(item.mrp) === 0) && item.invCcRowId) {
                    try {
                        const mrpCell = await InvCcCell.findOne({
                            where: {
                                ccRowId: item.invCcRowId,
                                columnId: { [Op.in]: ["col-cc-wholesale-mrp", "col-cc-mrp"] }
                            },
                            order: [["columnId", "DESC"]]
                        });
                        if (mrpCell && mrpCell.rawValue) {
                            item.mrp = parseFloat(mrpCell.rawValue) || 0;
                        }
                    } catch (_) { /* ignore */ }
                }
            }
        }

        if (plainInvoice.partyId && plainInvoice.partyType) {
            try {
                const PartyModel = getPartyModel(plainInvoice.partyType);
                const partyObj = await PartyModel.findByPk(plainInvoice.partyId);
                if (partyObj) {
                    plainInvoice.party = partyObj.get({ plain: true });
                }
            } catch (err) {
                console.error("Error populating party for invoice:", err);
            }
        }
        // Ensure additionalCharges is always a parsed array (Sequelize can return JSON fields as strings)
        if (plainInvoice.additionalCharges && typeof plainInvoice.additionalCharges === 'string') {
            try { plainInvoice.additionalCharges = JSON.parse(plainInvoice.additionalCharges); } catch { plainInvoice.additionalCharges = []; }
        }
        res.json({ data: plainInvoice });
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
            itemSubtotal, discountAmount, additionalChargesAmount, additionalCharges, roundOffAmount,
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
                    mrp: item.mrp || 0,
                    gstPercent: item.gstPercent || item.gst || 5,
                    disPercent: item.disPercent || item.marginPercent || item.discount || 0,
                    expiry: item.expiry || item.expDate || '',
                    hsnCode: item.hsnCode || item.hsn || '',
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
            itemSubtotal: itemSubtotal !== undefined ? itemSubtotal : invoice.itemSubtotal,
            discountAmount: discountAmount !== undefined ? discountAmount : invoice.discountAmount,
            additionalChargesAmount: additionalChargesAmount !== undefined ? additionalChargesAmount : invoice.additionalChargesAmount,
            additionalCharges: additionalCharges !== undefined ? additionalCharges : invoice.additionalCharges,
            roundOffAmount: roundOffAmount !== undefined ? roundOffAmount : invoice.roundOffAmount,
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

        const ledgerStatus = newPaymentStatus === "Paid" ? "Settled" : (newPaymentStatus === "Partially Paid" ? "Partially Paid" : "Pending");
        const ledgerPending = newPaymentStatus === "Paid" ? 0 : (newPendingAmount !== undefined ? newPendingAmount : newGrandTotal || 0);

        const [ledger, created] = await LedgerEntry.findOrCreate({
            where: { invoiceId: invoice.id },
            defaults: {
                invoiceNo: invoice.invoiceNo,
                type: invoice.type === "retail" ? "Retail" : "Wholesale",
                customerName: partyName || invoice.partyName || "",
                phone: "",
                date: invoiceDate || invoice.invoiceDate,
                pendingAmount: ledgerPending,
                status: ledgerStatus
            },
            transaction: t
        });
        if (!created) {
            await ledger.update({
                customerName: partyName || invoice.partyName || "",
                date: invoiceDate || invoice.invoiceDate,
                pendingAmount: ledgerPending,
                status: ledgerStatus
            }, { transaction: t });
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

        // Auto-sync existing invoices into LedgerEntry if missing
        const invoices = await Invoice.findAll({ where: { isDeleted: false } });
        for (const inv of invoices) {
            const existingLedger = await LedgerEntry.findOne({ where: { invoiceId: inv.id } });
            if (!existingLedger) {
                const initialStatus = inv.paymentStatus === "Paid" ? "Settled" : (inv.paymentStatus === "Partially Paid" ? "Partially Paid" : "Pending");
                const initialPending = inv.paymentStatus === "Paid" ? 0 : (Number(inv.pendingAmount) > 0 ? Number(inv.pendingAmount) : Number(inv.grandTotal || 0));
                await LedgerEntry.create({
                    invoiceId: inv.id,
                    invoiceNo: inv.invoiceNo,
                    type: inv.type === "retail" ? "Retail" : "Wholesale",
                    customerName: inv.partyName || "Customer",
                    phone: "",
                    date: inv.invoiceDate,
                    pendingAmount: initialPending,
                    status: initialStatus
                });
            }
        }

        const entries = await LedgerEntry.findAll({ where, order: [["createdAt", "DESC"]] });
        res.json({ data: entries });
    } catch (e) { next(e); }
};

export const updateLedger = async (req, res, next) => {
    try {
        const entry = await LedgerEntry.findOne({ where: { id: req.params.id, isDeleted: false } });
        if (!entry) throw new AppError("Ledger entry not found", 404);
        const { status, pendingAmount, proofUrl } = req.body;
        await entry.update({
            ...(status ? { status } : {}),
            ...(pendingAmount !== undefined ? { pendingAmount } : {}),
            ...(proofUrl !== undefined ? { proofUrl } : {})
        });
        if (status === "Settled" && entry.invoiceId) {
            await Invoice.update({ paymentStatus: "Paid", pendingAmount: 0 }, { where: { id: entry.invoiceId } });
        }
        res.json({ data: entry, message: "Ledger updated" });
    } catch (e) { next(e); }
};
