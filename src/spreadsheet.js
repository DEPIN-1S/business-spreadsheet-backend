import http from "http";
import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import sequelize from "./config/db.js";
import logger from "./config/logger.js";
import { initSocket } from "./config/socket.js";
import "./config/associations.js";

const PORT = process.env.PORT || 6043;
const httpServer = http.createServer(app);

initSocket(httpServer);

sequelize
  .sync() // no alter here
  .then(() => {
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