import sequelize from "./config/db.js";
import InvCcMeta from "./features/inv_sheet/inv_cc_meta.model.js";
import InvRow from "./features/inv_sheet/inv_row.model.js";

try {
    await sequelize.authenticate();
    console.log("DB connected OK");

    // Get all inv_rows to find a valid rowId
    const [rows] = await sequelize.query("SELECT id, spreadsheetId FROM inv_rows LIMIT 5");
    console.log("\nSample inv_rows:");
    rows.forEach(r => console.log("  rowId:", r.id, "sheetId:", r.spreadsheetId));

    if (rows.length > 0) {
        const testRowId = rows[0].id;
        console.log("\nTesting updateCcMeta with rowId:", testRowId);

        // Try upsert with rackNo
        let meta = await InvCcMeta.findOne({ where: { rowId: testRowId } });
        console.log("Existing meta:", meta ? JSON.stringify(meta.toJSON()) : "null");

        if (meta) {
            await meta.update({ rackNo: "TEST-RACK-01" });
            console.log("Updated meta rackNo:", meta.rackNo);
        } else {
            meta = await InvCcMeta.create({ rowId: testRowId, rackNo: "TEST-RACK-01" });
            console.log("Created meta rackNo:", meta.rackNo);
        }

        // Verify
        const check = await InvCcMeta.findOne({ where: { rowId: testRowId } });
        console.log("Verified rackNo in DB:", check.rackNo);
    }

} catch (err) {
    console.error("Error:", err.message, err.stack);
} finally {
    await sequelize.close();
}
