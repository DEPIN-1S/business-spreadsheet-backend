const { Sequelize } = require('sequelize');
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false
});

async function run() {
    try {
        const [results] = await sequelize.query("SELECT fullData FROM data_sheets LIMIT 2");
        results.forEach(row => {
            const data = JSON.parse(row.fullData);
            console.log("Keys:", Object.keys(data[0] || {}));
            console.log("Data:", data[0]);
        });
    } catch (e) {
        console.log(e.message);
    }
}
run();
