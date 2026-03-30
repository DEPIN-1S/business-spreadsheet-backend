import sequelize from "./src/config/db.js";

async function updateEnum() {
    try {
        console.log("Adding 'pdf' to Column type ENUM...");
        await sequelize.query(`
            ALTER TABLE columns 
            MODIFY COLUMN type ENUM('text', 'number', 'image', 'video', 'formula', 'comment', 'date', 'dropdown', 'currency', 'multi_image', 'pdf') 
            DEFAULT 'text'
        `);
        console.log("✅ Successfully updated Column type ENUM.");
    } catch (err) {
        console.error("❌ Failed to update ENUM:", err.message);
    } finally {
        await sequelize.close();
    }
}

updateEnum();
