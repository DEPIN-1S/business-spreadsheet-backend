import sequelize from './src/config/db.js';
import User from './src/features/user/user.model.js';

async function fixUsers() {
    try {
        console.log("Updating empty phone users...");
        await sequelize.query(`UPDATE users SET phone = CONCAT(id) WHERE phone IS NULL OR phone = ''`);
        console.log("Syncing db...");
        await sequelize.sync({ alter: true });
        console.log("Database synced successfully.");
    } catch (err) {
        console.error("Error syncing DB:", err);
    } finally {
        process.exit();
    }
}

fixUsers();
