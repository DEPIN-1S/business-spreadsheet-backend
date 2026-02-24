import dotenv from "dotenv";
dotenv.config();
import "./config/associations.js";
import sequelize from "./config/db.js";

(async () => {
    try {
        await sequelize.authenticate();
        console.log("DB connection OK");
        await sequelize.sync({ alter: true });
        console.log("Sync OK");
    } catch (err) {
        console.error("=== FULL ERROR ===");
        console.error(err.name);
        console.error(err.message);
        if (err.original) console.error("ORIGINAL:", err.original.message);
        if (err.errors) err.errors.forEach(e => console.error("  -", e.message));
    } finally {
        await sequelize.close();
        process.exit(0);
    }
})();
