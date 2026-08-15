import sequelize from "./config/db.js";
import InvFolder from "./features/inv_sheet/inv_folder.model.js";
import InvSpreadsheet from "./features/inv_sheet/inv_spreadsheet.model.js";

try {
    await sequelize.authenticate();
    console.log("DB connected OK");

    // Check raw SQL
    const [folderRows] = await sequelize.query("SELECT id, title, isDeleted, parentId FROM inv_folders LIMIT 20");
    console.log(`\nRAW inv_folders rows (${folderRows.length}):`);
    folderRows.forEach(r => console.log("  ", JSON.stringify(r)));

    const [sheetRows] = await sequelize.query("SELECT id, name, folderId, isDeleted FROM inv_spreadsheets LIMIT 20");
    console.log(`\nRAW inv_spreadsheets rows (${sheetRows.length}):`);
    sheetRows.forEach(r => console.log("  ", JSON.stringify(r)));

    // Check via Sequelize model
    const folders = await InvFolder.findAll({ where: { isDeleted: false } });
    console.log(`\nSequelize folders (isDeleted=false): ${folders.length}`);
    folders.forEach(f => console.log("  ", f.title, f.id));

    const sheets = await InvSpreadsheet.findAll({ where: { isDeleted: false } });
    console.log(`\nSequelize sheets (isDeleted=false): ${sheets.length}`);
    sheets.forEach(s => console.log("  ", s.name, s.id));

} catch (err) {
    console.error("Error:", err.message);
} finally {
    await sequelize.close();
}
