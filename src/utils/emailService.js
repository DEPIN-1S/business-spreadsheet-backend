import nodemailer from "nodemailer";

/**
 * Creates and returns a nodemailer SMTP transporter using .env settings
 */
const getTransporter = () => {
    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    const secure = process.env.SMTP_SECURE === "true";
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!user || !pass) {
        return null;
    }

    return nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass }
    });
};

/**
 * Send an email alert for stock notifications (Low Stock, Out of Stock, Expiry Alert)
 */
export const sendStockAlertEmail = async ({
    type,
    title,
    message,
    productName,
    batchName,
    currentQty,
    expiryDate,
    recipientEmail
}) => {
    try {
        const transporter = getTransporter();
        const to = recipientEmail || process.env.ALERT_EMAIL_RECIPIENT || process.env.SA_EMAIL;

        if (!transporter) {
            console.log(`[EmailService] SMTP credentials not fully set in .env (SMTP_USER/SMTP_PASS). Skipping email dispatch for: "${title}".`);
            return false;
        }

        if (!to) {
            console.log(`[EmailService] No recipient email configured (ALERT_EMAIL_RECIPIENT). Skipping email dispatch for: "${title}".`);
            return false;
        }

        const from = process.env.SMTP_FROM || `"Datsheets Alerts" <${process.env.SMTP_USER}>`;
        
        const badgeColor =
            type === "out_of_stock" ? "#dc2626" :
            type === "expiry_alert" ? "#d97706" :
                                      "#eab308";

        const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; rounded: 8px;">
                <div style="background-color: ${badgeColor}; color: white; padding: 12px 20px; font-weight: bold; border-radius: 6px 6px 0 0;">
                    ${title}
                </div>
                <div style="padding: 20px; background-color: #ffffff;">
                    <p style="font-size: 14px; color: #374151;">${message}</p>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px;">
                        <tr style="border-bottom: 1px solid #f3f4f6;">
                            <td style="padding: 8px; font-weight: bold; color: #4b5563;">Product Name:</td>
                            <td style="padding: 8px; color: #111827;">${productName || 'N/A'}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #f3f4f6;">
                            <td style="padding: 8px; font-weight: bold; color: #4b5563;">Batch Name:</td>
                            <td style="padding: 8px; color: #111827;">${batchName || 'N/A'}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #f3f4f6;">
                            <td style="padding: 8px; font-weight: bold; color: #4b5563;">Current Stock:</td>
                            <td style="padding: 8px; color: #111827; font-weight: bold;">${currentQty !== undefined ? currentQty : 'N/A'} units</td>
                        </tr>
                        ${expiryDate ? `
                        <tr style="border-bottom: 1px solid #f3f4f6;">
                            <td style="padding: 8px; font-weight: bold; color: #4b5563;">Expiry Date:</td>
                            <td style="padding: 8px; color: #111827;">${expiryDate}</td>
                        </tr>` : ''}
                    </table>
                </div>
                <div style="padding: 12px 20px; background-color: #f9fafb; font-size: 11px; color: #9ca3af; text-align: center; border-radius: 0 0 6px 6px;">
                    This is an automated inventory alert from Datsheets.
                </div>
            </div>
        `;

        const info = await transporter.sendMail({
            from,
            to,
            subject: `[ALERT] ${title}`,
            text: `${title}\n\n${message}\nProduct: ${productName}\nBatch: ${batchName}\nCurrent Stock: ${currentQty}`,
            html: htmlContent
        });

        console.log(`[EmailService] Email sent successfully to ${to}. MessageId: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error(`[EmailService] Failed to send email alert for "${title}":`, error.message);
        return false;
    }
};

/**
 * Send an email alert for Pending Customer Payments (Partially Paid / Unpaid after 30 days)
 */
export const sendPendingPaymentEmail = async ({
    invoiceNo,
    partyName,
    partyContact,
    partyEmail,
    invoiceDate,
    paymentStatus,
    grandTotal,
    paidAmount,
    pendingAmount,
    recipientEmail
}) => {
    try {
        const transporter = getTransporter();
        const to = recipientEmail || process.env.BILLING_ALERT_EMAIL_RECIPIENT || process.env.ALERT_EMAIL_RECIPIENT || process.env.SA_EMAIL;

        if (!transporter) {
            console.log(`[EmailService] SMTP credentials not set. Skipping pending payment email for Invoice ${invoiceNo}.`);
            return false;
        }

        if (!to) {
            console.log(`[EmailService] No recipient email configured. Skipping pending payment email for Invoice ${invoiceNo}.`);
            return false;
        }

        const from = process.env.BILLING_SMTP_FROM || `"Billing & Payment Alerts" <${process.env.SMTP_USER}>`;
        const title = `Pending Payment Alert: ${partyName}`;
        const statusBadgeColor = paymentStatus === "Partially Paid" ? "#d97706" : "#dc2626";

        const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                <div style="background-color: ${statusBadgeColor}; color: white; padding: 14px 20px; font-weight: bold; border-radius: 6px 6px 0 0; font-size: 16px;">
                    ⚠️ ${title}
                </div>
                <div style="padding: 20px; background-color: #ffffff;">
                    <p style="font-size: 14px; color: #374151; margin-bottom: 16px;">
                        This customer has a remaining pending balance for invoice <strong>${invoiceNo}</strong> (generated on ${invoiceDate}). Please follow up for collection.
                    </p>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px;">
                        <tr style="border-bottom: 1px solid #f3f4f6;">
                            <td style="padding: 10px 8px; font-weight: bold; color: #4b5563; width: 40%;">Customer Name:</td>
                            <td style="padding: 10px 8px; color: #111827; font-weight: bold;">${partyName || 'N/A'}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #f3f4f6;">
                            <td style="padding: 10px 8px; font-weight: bold; color: #4b5563;">Contact Number:</td>
                            <td style="padding: 10px 8px; color: #111827;">${partyContact || 'N/A'}</td>
                        </tr>
                        ${partyEmail ? `
                        <tr style="border-bottom: 1px solid #f3f4f6;">
                            <td style="padding: 10px 8px; font-weight: bold; color: #4b5563;">Customer Email:</td>
                            <td style="padding: 10px 8px; color: #111827;">${partyEmail}</td>
                        </tr>` : ''}
                        <tr style="border-bottom: 1px solid #f3f4f6;">
                            <td style="padding: 10px 8px; font-weight: bold; color: #4b5563;">Invoice Number:</td>
                            <td style="padding: 10px 8px; color: #111827; font-mono;">${invoiceNo}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #f3f4f6;">
                            <td style="padding: 10px 8px; font-weight: bold; color: #4b5563;">Invoice Date:</td>
                            <td style="padding: 10px 8px; color: #111827;">${invoiceDate}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #f3f4f6;">
                            <td style="padding: 10px 8px; font-weight: bold; color: #4b5563;">Payment Status:</td>
                            <td style="padding: 10px 8px;">
                                <span style="background-color: ${statusBadgeColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">
                                    ${paymentStatus}
                                </span>
                            </td>
                        </tr>
                        <tr style="border-bottom: 1px solid #f3f4f6;">
                            <td style="padding: 10px 8px; font-weight: bold; color: #4b5563;">Total Bill Amount:</td>
                            <td style="padding: 10px 8px; color: #111827;">₹${Number(grandTotal).toFixed(2)}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #f3f4f6;">
                            <td style="padding: 10px 8px; font-weight: bold; color: #4b5563;">Amount Paid So Far:</td>
                            <td style="padding: 10px 8px; color: #16a34a; font-weight: bold;">₹${Number(paidAmount).toFixed(2)}</td>
                        </tr>
                        <tr style="background-color: #fef2f2;">
                            <td style="padding: 10px 8px; font-weight: bold; color: #991b1b;">Remaining Pending Amount:</td>
                            <td style="padding: 10px 8px; color: #dc2626; font-weight: bold; font-size: 15px;">₹${Number(pendingAmount).toFixed(2)}</td>
                        </tr>
                    </table>
                </div>
                <div style="padding: 12px 20px; background-color: #f9fafb; font-size: 11px; color: #9ca3af; text-align: center; border-radius: 0 0 6px 6px;">
                    This is an automated billing pending payment alert from Datsheets.
                </div>
            </div>
        `;

        const info = await transporter.sendMail({
            from,
            to,
            subject: `[PAYMENT ALERT] Pending Balance: ${partyName} (₹${Number(pendingAmount).toFixed(2)})`,
            text: `${title}\n\nInvoice: ${invoiceNo}\nDate: ${invoiceDate}\nStatus: ${paymentStatus}\nTotal: ₹${grandTotal}\nPaid: ₹${paidAmount}\nPending: ₹${pendingAmount}`,
            html: htmlContent
        });

        console.log(`[EmailService] Pending payment alert email sent to ${to}. MessageId: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error(`[EmailService] Failed to send pending payment email for Invoice "${invoiceNo}":`, error.message);
        return false;
    }
};

export default { sendStockAlertEmail, sendPendingPaymentEmail };
