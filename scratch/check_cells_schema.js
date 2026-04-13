import sequelize from "./src/config/db.js";

async function checkCellsTable() {
    try {
        const [results] = await sequelize.query("DESCRIBE cells");
        console.log("Columns in 'cells' table:");
        results.forEach(res => console.log(`- ${res.Field}: ${res.Type}`));
    } catch (err) {
        console.error("Error describing table:", err);
    } finally {
        await sequelize.close();
    }
}

checkCellsTable();
