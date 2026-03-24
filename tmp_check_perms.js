import sequelize from './src/config/db.js';
import SheetPermission from './src/features/spreadsheet/permission.model.js';

async function check() {
    try {
        const userId = 'c91c7ef0-8789-4cb6-92df-b01857fdb4bd';
        const spreadsheetId = 'ba42f12f-a4fb-4db8-8e6d-ce4f04a82135';
        
        console.log('Testing SheetPermission.findOne...');
        const perm = await SheetPermission.findOne({ where: { userId, spreadsheetId } });
        
        if (perm) {
            console.log('PERM FOUND:', JSON.stringify(perm, null, 2));
        } else {
            console.log('PERM NOT FOUND');
        }
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
check();
