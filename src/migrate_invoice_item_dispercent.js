import sequelize from "./config/db.js";

async function run() {
    try {
        await sequelize.authenticate();
        console.log("DB connected OK");

        const [cols] = await sequelize.query("SHOW COLUMNS FROM invoice_items LIKE 'disPercent'");
        if (cols.length === 0) {
            await sequelize.query("ALTER TABLE invoice_items ADD COLUMN disPercent DECIMAL(10, 2) DEFAULT 0 AFTER gstPercent");
            console.log("✅ Added column 'disPercent' to invoice_items");
        } else {
            console.log("ℹ️ Column 'disPercent' already exists in invoice_items");
        }

    } catch (err) {
        console.error("Migration error:", err);
    } finally {
        await sequelize.close();
    }
}

run();
