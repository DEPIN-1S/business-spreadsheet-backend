import { Sequelize, DataTypes } from 'sequelize';
const sequelize = new Sequelize('u689598822_spreadsheetdb', 'u689598822_spreadsheetdb', 'Shifa#clinic@123', { host: 'srv2203.hstgr.io', dialect: 'mysql', logging: false });
const Column = sequelize.define('Column', { name: DataTypes.STRING, spreadsheetId: DataTypes.STRING }, { tableName: 'columns', timestamps: false });
async function run() {
    const cols = await Column.findAll({ where: { spreadsheetId: 'd6a362f6-eb2f-4db1-9b19-3cc1d59665bc' } }); // I don't know the exact spreadsheetId, let's query all columns that contain 'product'
    const productCols = await Column.findAll({ where: { name: { [Sequelize.Op.like]: '%product%' } }});
    console.log('Product cols count:', productCols.length);
    productCols.slice(0, 5).forEach(c => console.log(c.toJSON()));
    sequelize.close();
}
run();
