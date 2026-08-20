import sequelize from "./config/db.js";

try {
    await sequelize.authenticate();
    console.log("DB connected OK");

    // ── wholesale_parties ──────────────────────────────────────────────────────
    const [wCols] = await sequelize.query("SHOW COLUMNS FROM wholesale_parties");
    const wColNames = wCols.map(c => c.Field);

    if (!wColNames.includes('billingAddress')) {
        await sequelize.query("ALTER TABLE wholesale_parties ADD COLUMN billingAddress TEXT DEFAULT NULL");
        // Backfill from existing address
        await sequelize.query("UPDATE wholesale_parties SET billingAddress = address WHERE billingAddress IS NULL AND address IS NOT NULL");
        console.log("✅ billingAddress added to wholesale_parties");
    } else {
        console.log("ℹ️  billingAddress already exists in wholesale_parties");
    }

    if (!wColNames.includes('shippingAddress')) {
        await sequelize.query("ALTER TABLE wholesale_parties ADD COLUMN shippingAddress TEXT DEFAULT NULL");
        // Backfill shipping = billing
        await sequelize.query("UPDATE wholesale_parties SET shippingAddress = billingAddress WHERE shippingAddress IS NULL AND billingAddress IS NOT NULL");
        console.log("✅ shippingAddress added to wholesale_parties");
    } else {
        console.log("ℹ️  shippingAddress already exists in wholesale_parties");
    }

    // ── invoices ───────────────────────────────────────────────────────────────
    const [iCols] = await sequelize.query("SHOW COLUMNS FROM invoices");
    const iColNames = iCols.map(c => c.Field);

    if (!iColNames.includes('billingAddress')) {
        await sequelize.query("ALTER TABLE invoices ADD COLUMN billingAddress TEXT DEFAULT NULL");
        console.log("✅ billingAddress added to invoices");
    } else {
        console.log("ℹ️  billingAddress already exists in invoices");
    }

    if (!iColNames.includes('shippingAddress')) {
        await sequelize.query("ALTER TABLE invoices ADD COLUMN shippingAddress TEXT DEFAULT NULL");
        console.log("✅ shippingAddress added to invoices");
    } else {
        console.log("ℹ️  shippingAddress already exists in invoices");
    }

    // Verify
    const [wFinal] = await sequelize.query("SHOW COLUMNS FROM wholesale_parties");
    console.log("\nwholesale_parties columns:", wFinal.map(c => c.Field).join(", "));

    const [iFinal] = await sequelize.query("SHOW COLUMNS FROM invoices");
    console.log("invoices columns:", iFinal.map(c => c.Field).join(", "));

} catch (err) {
    console.error("Migration error:", err.message);
} finally {
    await sequelize.close();
}
