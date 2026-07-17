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

export default { sendStockAlertEmail };
