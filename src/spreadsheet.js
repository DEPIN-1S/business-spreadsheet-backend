import http from "http";
import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import sequelize from "./config/db.js";
import logger from "./config/logger.js";
import { initSocket } from "./config/socket.js";
import "./config/associations.js";
import { initCron } from "./features/inv_notifications/inv_notification.cron.js";
import { updatePartiesAgeForNewYear } from "./features/business/party_age.service.js";

const PORT = process.env.PORT || 6043;
const httpServer = http.createServer(app);

initSocket(httpServer);
initCron();

async function ensurePartyColumns() {
    const alterQuery = async (table, col, def) => {
        try {
            await sequelize.query(`ALTER TABLE ${table} ADD COLUMN ${col} ${def};`);
        } catch (e) {
            // Ignore if column already exists
        }
    };
    await alterQuery('retail_parties', 'registrationNo', 'TEXT NULL');
    await alterQuery('retail_parties', 'dlNo', 'VARCHAR(100) NULL');
    await alterQuery('retail_parties', 'gstinNo', 'VARCHAR(100) NULL');
    await alterQuery('retail_parties', 'panNo', 'VARCHAR(100) NULL');
    await alterQuery('retail_parties', 'dobYear', 'INT NULL');
    await alterQuery('retail_parties', 'age', 'VARCHAR(50) NULL');
    await alterQuery('retail_parties', 'gender', 'VARCHAR(50) NULL');
    await alterQuery('retail_parties', 'ageLastUpdatedYear', 'INT NULL');
    await alterQuery('retail_parties', 'createdBy', 'VARCHAR(36) NULL');

    await alterQuery('wholesale_parties', 'registrationNo', 'TEXT NULL');
    await alterQuery('wholesale_parties', 'dlNo', 'VARCHAR(100) NULL');
    await alterQuery('wholesale_parties', 'gstinNo', 'VARCHAR(100) NULL');
    await alterQuery('wholesale_parties', 'panNo', 'VARCHAR(100) NULL');
    await alterQuery('wholesale_parties', 'dobYear', 'INT NULL');
    await alterQuery('wholesale_parties', 'age', 'VARCHAR(50) NULL');
    await alterQuery('wholesale_parties', 'gender', 'VARCHAR(50) NULL');
    await alterQuery('wholesale_parties', 'ageLastUpdatedYear', 'INT NULL');
    await alterQuery('wholesale_parties', 'createdBy', 'VARCHAR(36) NULL');

    await alterQuery('business_parties', 'gender', 'VARCHAR(50) NULL');
    await alterQuery('business_parties', 'ageLastUpdatedYear', 'INT NULL');

    await alterQuery('invoices', 'createdBy', 'VARCHAR(36) NULL');
    await alterQuery('invoices', 'itemSubtotal', 'DECIMAL(15,2) DEFAULT 0');
    await alterQuery('invoices', 'discountAmount', 'DECIMAL(15,2) DEFAULT 0');
    await alterQuery('invoices', 'additionalChargesAmount', 'DECIMAL(15,2) DEFAULT 0');
    await alterQuery('invoices', 'additionalCharges', 'TEXT NULL');
    await alterQuery('invoices', 'roundOffAmount', 'DECIMAL(15,2) DEFAULT 0');

    await alterQuery('ledger_entries', 'createdBy', 'VARCHAR(36) NULL');
    await alterQuery('ledger_entries', 'proofUrl', 'LONGTEXT NULL');

    await alterQuery('invoice_items', 'mrp', 'DECIMAL(15,2) DEFAULT 0');
    await alterQuery('invoice_items', 'gstPercent', 'DECIMAL(5,2) DEFAULT 5');
    await alterQuery('invoice_items', 'expiry', 'VARCHAR(50) NULL');
    await alterQuery('invoice_items', 'hsnCode', 'VARCHAR(50) NULL');

    await alterQuery('inv_notifications', 'invoiceDate', 'DATE NULL');
    await alterQuery('templates', 'signatureImage', 'LONGTEXT NULL');
    await alterQuery('templates', 'spreadsheetIds', 'LONGTEXT NULL');
    await alterQuery('businesses', 'seals', 'LONGTEXT NULL');
}

sequelize
  .sync({ alter: false })
  .then(async () => {
    await ensurePartyColumns();
    await updatePartiesAgeForNewYear();
    logger.info("✅ Database synced");
    httpServer.listen(PORT, () => {
      logger.info(`🚀 Server running on http://localhost:${PORT}`);
      logger.info(`📡 Socket.IO ready`);
    });
  })
  .catch((err) => {
    logger.error("❌ Database sync failed: " + err);
    process.exit(1);
  });
