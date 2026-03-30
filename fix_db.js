import sequelize from "./src/config/db.js";
import "./src/config/associations.js";

async function fix() {
  const queryInterface = sequelize.getQueryInterface();
  
  const tables = ["cells", "rows", "columns"];
  const newCols = ["isBold", "isItalic"];

  for (const table of tables) {
    for (const col of newCols) {
      try {
        await queryInterface.addColumn(table, col, {
          type: sequelize.Sequelize.BOOLEAN,
          defaultValue: false,
          allowNull: false
        });
        console.log(`✅ Added ${col} to ${table}`);
      } catch (err) {
        if (err.parent && err.parent.errno === 1060) {
          console.log(`ℹ️ Column ${col} already exists in ${table}`);
        } else {
          console.error(`❌ Error adding ${col} to ${table}:`, err.message);
        }
      }
    }
  }
  process.exit(0);
}

fix();
