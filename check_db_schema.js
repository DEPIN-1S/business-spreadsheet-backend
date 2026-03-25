import sequelize from "./src/config/db.js";
import Column from "./src/features/spreadsheet/column.model.js";

async function checkTable() {
    try {
        const [results] = await sequelize.query("DESCRIBE columns");
        console.log("Columns in 'columns' table:");
        results.forEach(res => console.log(`- ${res.Field}: ${res.Type}`));
    } catch (err) {
        console.error("Error describing table:", err);
    } finally {
        await sequelize.close();
    }
}

checkTable();
