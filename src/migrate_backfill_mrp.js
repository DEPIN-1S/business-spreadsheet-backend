import sequelize from "./config/db.js";

try {
    await sequelize.authenticate();
    console.log("DB connected OK");

    // Get all invoice items where mrp is 0 and invCcRowId is set
    const [zeroMrpItems] = await sequelize.query(
        "SELECT id, invCcRowId, description, mrp FROM invoice_items WHERE (mrp = 0 OR mrp IS NULL) AND invCcRowId IS NOT NULL"
    );
    console.log(`Found ${zeroMrpItems.length} invoice items with mrp=0 to backfill...`);

    let updated = 0;
    for (const item of zeroMrpItems) {
        // Try col-cc-wholesale-mrp first, then col-cc-mrp
        const [mrpCells] = await sequelize.query(
            "SELECT columnId, rawValue FROM inv_cc_cells WHERE ccRowId = ? AND columnId IN ('col-cc-wholesale-mrp', 'col-cc-mrp') AND rawValue != '' ORDER BY columnId DESC LIMIT 1",
            { replacements: [item.invCcRowId] }
        );
        if (mrpCells.length > 0 && mrpCells[0].rawValue) {
            const mrpVal = parseFloat(mrpCells[0].rawValue);
            if (mrpVal > 0) {
                await sequelize.query(
                    "UPDATE invoice_items SET mrp = ? WHERE id = ?",
                    { replacements: [mrpVal, item.id] }
                );
                console.log(`  ✅ ${item.description}: mrp set to ${mrpVal} (from ${mrpCells[0].columnId})`);
                updated++;
            }
        }
    }

    console.log(`\n✅ Done. Updated ${updated} / ${zeroMrpItems.length} invoice items with MRP data.`);

    // Verify
    const [sample] = await sequelize.query(
        "SELECT description, mrp, price FROM invoice_items LIMIT 10"
    );
    console.log("\nSample invoice_items after backfill:");
    sample.forEach(r => console.log(`  ${r.description}: mrp=${r.mrp}, price=${r.price}`));

} catch (err) {
    console.error("Error:", err.message);
} finally {
    await sequelize.close();
}
