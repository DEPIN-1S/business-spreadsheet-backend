import sequelize from "./config/db.js";

try {
    await sequelize.authenticate();
    console.log("DB connected OK");

    // Add composition column to inv_cc_meta table if it doesn't exist
    const [cols] = await sequelize.query("SHOW COLUMNS FROM inv_cc_meta LIKE 'composition'");
    if (cols.length === 0) {
        await sequelize.query("ALTER TABLE inv_cc_meta ADD COLUMN composition VARCHAR(500) DEFAULT NULL");
        console.log("✅ composition column added to inv_cc_meta");
    } else {
        console.log("ℹ️  composition column already exists in inv_cc_meta");
    }

    // Verify
    const [allCols] = await sequelize.query("SHOW COLUMNS FROM inv_cc_meta");
    console.log("\nCurrent inv_cc_meta columns:");
    allCols.forEach(c => console.log("  -", c.Field, c.Type));

} catch (err) {
    console.error("Error:", err.message);
} finally {
    await sequelize.close();
}
