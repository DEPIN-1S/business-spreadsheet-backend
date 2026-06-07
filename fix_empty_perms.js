import ColumnPermission from './src/features/spreadsheet/column_permission.model.js';
import sequelize from './src/config/db.js';

async function run() {
    try {
        await sequelize.authenticate();
        console.log('Connected to database.');

        // Find all column permissions where columnAccess is an empty object or null
        const perms = await ColumnPermission.findAll();
        let deletedCount = 0;
        
        for (const p of perms) {
            let access = p.columnAccess;
            let shouldDelete = false;

            if (!access) {
                shouldDelete = true;
            } else if (typeof access === 'string') {
                try {
                    const parsed = JSON.parse(access);
                    if (Object.keys(parsed).length === 0) shouldDelete = true;
                } catch(e) {
                    if (access.trim() === '{}' || access.trim() === '') shouldDelete = true;
                }
            } else if (typeof access === 'object') {
                if (Object.keys(access).length === 0) shouldDelete = true;
            }

            if (shouldDelete) {
                await p.destroy();
                deletedCount++;
            }
        }

        console.log(`Successfully deleted ${deletedCount} empty ColumnPermission records.`);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
