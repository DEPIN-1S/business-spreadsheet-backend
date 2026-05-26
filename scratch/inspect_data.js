import User from '../src/features/user/user.model.js';
import Folder from '../src/features/spreadsheet/folder.model.js';
import Spreadsheet from '../src/features/spreadsheet/spreadsheet.model.js';
import sequelize from '../src/config/db.js';

async function main() {
    try {
        await sequelize.authenticate();
        console.log("✅ DB Connected");

        const users = await User.findAll();
        console.log("\n--- USERS ---");
        console.table(users.map(u => ({ id: u.id, name: u.name, phone: u.phone, role: u.role })));

        const folders = await Folder.findAll({ where: { isDeleted: false } });
        console.log("\n--- FOLDERS ---");
        console.table(folders.map(f => ({ id: f.id, name: f.name, createdBy: f.createdBy, parentId: f.parentId })));

        const sheets = await Spreadsheet.findAll({ where: { isDeleted: false, isDetailedView: false } });
        console.log("\n--- SPREADSHEETS ---");
        console.table(sheets.map(s => ({ id: s.id, name: s.name, createdBy: s.createdBy, folderId: s.folderId })));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
main();
