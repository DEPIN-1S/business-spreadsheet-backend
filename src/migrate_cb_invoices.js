import sequelize from "./config/db.js";

async function migrate() {
  try {
    const [cols] = await sequelize.query("SHOW COLUMNS FROM saved_invoices LIKE 'isCb'");
    if (cols.length === 0) {
      await sequelize.query("ALTER TABLE saved_invoices ADD COLUMN isCb TINYINT(1) NOT NULL DEFAULT 0");
      console.log("Successfully added isCb column to saved_invoices");
    } else {
      console.log("isCb column already exists");
    }
    const [check] = await sequelize.query("SHOW COLUMNS FROM saved_invoices");
    console.log("Current columns:", check.map(c => c.Field));
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await sequelize.close();
  }
}

migrate();
