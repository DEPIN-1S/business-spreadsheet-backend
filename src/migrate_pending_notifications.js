import sequelize from "./config/db.js";

try {
    await sequelize.authenticate();
    console.log("DB connected OK");

    const [cols] = await sequelize.query("SHOW COLUMNS FROM inv_notifications");
    const colNames = cols.map(c => c.Field);
    const typeCol = cols.find(c => c.Field === 'type');

    // 1. Modify type ENUM to include 'pending_payment_alert'
    if (typeCol && !typeCol.Type.includes('pending_payment_alert')) {
        await sequelize.query(
            "ALTER TABLE inv_notifications MODIFY COLUMN type ENUM('expiry_alert', 'low_stock', 'out_of_stock', 'pending_payment_alert') NOT NULL"
        );
        console.log("✅ Modified type ENUM in inv_notifications to include 'pending_payment_alert'");
    } else {
        console.log("ℹ️  type ENUM in inv_notifications already includes 'pending_payment_alert'");
    }

    // 2. Add invoice & payment columns
    const columnsToAdd = [
        { name: 'invoiceId', type: 'CHAR(36) DEFAULT NULL' },
        { name: 'invoiceNo', type: 'VARCHAR(100) DEFAULT NULL' },
        { name: 'partyName', type: 'VARCHAR(200) DEFAULT NULL' },
        { name: 'partyContact', type: 'VARCHAR(100) DEFAULT NULL' },
        { name: 'grandTotal', type: 'DECIMAL(15, 2) DEFAULT NULL' },
        { name: 'paidAmount', type: 'DECIMAL(15, 2) DEFAULT NULL' },
        { name: 'pendingAmount', type: 'DECIMAL(15, 2) DEFAULT NULL' },
        { name: 'paymentStatus', type: 'VARCHAR(50) DEFAULT NULL' }
    ];

    for (const col of columnsToAdd) {
        if (!colNames.includes(col.name)) {
            await sequelize.query(`ALTER TABLE inv_notifications ADD COLUMN ${col.name} ${col.type}`);
            console.log(`✅ Added column '${col.name}' to inv_notifications`);
        } else {
            console.log(`ℹ️  Column '${col.name}' already exists in inv_notifications`);
        }
    }

    // Verify columns
    const [finalCols] = await sequelize.query("SHOW COLUMNS FROM inv_notifications");
    console.log("\ninv_notifications columns:", finalCols.map(c => c.Field).join(", "));

} catch (err) {
    console.error("Migration error:", err.message);
} finally {
    await sequelize.close();
}
