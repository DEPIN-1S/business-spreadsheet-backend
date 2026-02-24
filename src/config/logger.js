import { createLogger, format, transports } from "winston";
import fs from "fs";
import path from "path";

const logDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.printf(i => `${i.timestamp} [${i.level}]: ${i.message}`)
  ),
  transports: [
    new transports.File({ filename: path.join(logDir,"error.log"), level:"error" }),
    new transports.File({ filename: path.join(logDir,"combined.log") }),
    new transports.Console()
  ]
});

export default logger;
