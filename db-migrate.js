import sequelize from "./src/config/db.js";

async function run() {
    try {
        console.log("Running DB sync(alter: true)...");
        await sequelize.sync({ alter: true });
        console.log("Migration complete");
    } catch (e) {
        console.error("Migration error:", e);
    } finally {
        process.exit(0);
    }
}
run();
