import http from "http";
import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import sequelize from "./config/db.js";
import logger from "./config/logger.js";
import { initSocket } from "./config/socket.js";
import "./config/associations.js";
import { initCron } from "./features/inv_notifications/inv_notification.cron.js";

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
    await alterQuery('retail_parties', 'age', 'INT NULL');

    await alterQuery('wholesale_parties', 'registrationNo', 'TEXT NULL');
    await alterQuery('wholesale_parties', 'dlNo', 'VARCHAR(100) NULL');
    await alterQuery('wholesale_parties', 'gstinNo', 'VARCHAR(100) NULL');
    await alterQuery('wholesale_parties', 'panNo', 'VARCHAR(100) NULL');
    await alterQuery('wholesale_parties', 'dobYear', 'INT NULL');
    await alterQuery('wholesale_parties', 'age', 'INT NULL');
}

sequelize
  .sync()
  .then(async () => {
    await ensurePartyColumns();
    logger.info("✅ Database synced");
    httpServer.listen(PORT, () => {
      logger.info(`🚀 Server running on http://localhost:${PORT}`);
      logger.info(`📡 Socket.IO ready`);
    });
  })
  .catch((err) => {
    logger.error("❌ Database sync failed: " + err.message);
    process.exit(1);
  });