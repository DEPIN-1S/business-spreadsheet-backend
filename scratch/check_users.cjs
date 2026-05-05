const User = require('./src/features/user/user.model.js');
const sequelize = require('./src/config/db.js');

async function checkUsers() {
    try {
        await sequelize.authenticate();
        const users = await User.findAll({ attributes: ['id', 'name', 'email', 'phone', 'role'] });
        console.log(JSON.stringify(users, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkUsers();
