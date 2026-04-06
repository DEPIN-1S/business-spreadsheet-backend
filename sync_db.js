import sequelize from './src/config/db.js';
import User from './src/features/user/user.model.js';

async function syncDb() {
    try {
        await sequelize.sync({ alter: true });
        console.log("Database synced successfully with alter: true.");
    } catch (err) {
        console.error("Error syncing DB:", err);
    } finally {
        process.exit();
    }
}

syncDb();
