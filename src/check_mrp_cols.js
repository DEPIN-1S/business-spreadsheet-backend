import sequelize from "./config/db.js";

try {
    await sequelize.authenticate();

    // Check what MRP/selling rate columns actually exist and have data
    const [mrpCells] = await sequelize.query(
        "SELECT columnId, rawValue FROM inv_cc_cells WHERE columnId LIKE '%mrp%' OR columnId LIKE '%selling%' OR columnId LIKE '%price%' LIMIT 30"
    );
    console.log("MRP/Selling cells in inventory:");
    console.log(JSON.stringify(mrpCells, null, 2));

    // Check all unique column IDs to see what's actually stored
    const [uniqueCols] = await sequelize.query(
        "SELECT DISTINCT columnId FROM inv_cc_cells ORDER BY columnId"
    );
    console.log("\nAll unique CC cell columnIds:");
    uniqueCols.forEach(c => console.log(" -", c.columnId));

} catch (err) {
    console.error("Error:", err.message);
} finally {
    await sequelize.close();
}
