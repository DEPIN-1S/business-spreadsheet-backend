import ColumnPermission from './src/features/spreadsheet/column_permission.model.js';
import sequelize from './src/config/db.js';

async function run() {
    try {
        await sequelize.authenticate();
        console.log('Connected to database.');

        const perms = await ColumnPermission.findAll();
        for (const p of perms) {
            console.log(`ID: ${p.id}, Sheet: ${p.spreadsheetId}, User: ${p.userId}, Access: ${JSON.stringify(p.columnAccess)}`);
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
