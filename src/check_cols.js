import sequelize from "./config/db.js";

try {
    await sequelize.authenticate();
    const [cols] = await sequelize.query("SELECT id, name, type, bgColor, options FROM columns");
    console.log("Found columns:", cols.length);
    cols.forEach(c => {
        if (c.bgColor || c.options) {
            console.log(`Col ${c.name} (${c.id}): bgColor=${c.bgColor}, options=${c.options}`);
        }
    });
} catch (err) {
    console.error(err);
} finally {
    await sequelize.close();
}
