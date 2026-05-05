import User from '../src/features/user/user.model.js';
import Folder from '../src/features/spreadsheet/folder.model.js';
import FolderPermission from '../src/features/spreadsheet/folder_permission.model.js';
import sequelize from '../src/config/db.js';

async function checkState() {
    try {
        await sequelize.authenticate();
        const staff = await User.findOne({ where: { phone: '8888888888' } });
        console.log('Staff User:', JSON.stringify(staff, null, 2));
        
        if (staff) {
            const perms = await FolderPermission.findAll({ where: { userId: staff.id } });
            console.log('Permissions:', JSON.stringify(perms, null, 2));
            
            const folders = await Folder.findAll({ where: { isDeleted: false } });
            console.log('All Folders:', JSON.stringify(folders.map(f => ({ id: f.id, name: f.name, parentId: f.parentId })), null, 2));
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkState();
