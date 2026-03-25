import sequelize from "./src/config/db.js";

async function checkIndexes() {
    try {
        const [cols] = await sequelize.query("SHOW INDEX FROM `columns` ");
        const [rows] = await sequelize.query("SHOW INDEX FROM `rows` ");
        const [cells] = await sequelize.query("SHOW INDEX FROM `cells` ");

        console.log("--- COLUMNS INDEXES ---");
        cols.forEach(idx => console.log(`  ${idx.Key_name}: ${idx.Column_name}`));

        console.log("\n--- ROWS INDEXES ---");
        rows.forEach(idx => console.log(`  ${idx.Key_name}: ${idx.Column_name}`));

        console.log("\n--- CELLS INDEXES ---");
        cells.forEach(idx => console.log(`  ${idx.Key_name}: ${idx.Column_name}`));

    } catch (err) {
        console.error("Error checking indexes:", err);
    } finally {
        await sequelize.close();
    }
}

checkIndexes();
