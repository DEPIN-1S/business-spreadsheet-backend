import { Sequelize, DataTypes } from 'sequelize';
const sequelize = new Sequelize('u689598822_spreadsheetdb', 'u689598822_spreadsheetdb', 'Shifa#clinic@123', { host: 'srv2203.hstgr.io', dialect: 'mysql', logging: false });
const Column = sequelize.define('Column', { name: DataTypes.STRING, spreadsheetId: DataTypes.STRING }, { tableName: 'columns', timestamps: false });
async function run() {
    const cols1 = await Column.findAll({ where: { spreadsheetId: '2e9e6eec-a83c-4006-b26f-8f8bf0dbaddb' } });
    const cols2 = await Column.findAll({ where: { spreadsheetId: '362c1d2e-1d53-4c61-95f8-8c4d3fca4844' } });
    console.log('Cols in sheet 1:', cols1.map(c => c.name));
    console.log('Cols in sheet 2:', cols2.map(c => c.name));
    sequelize.close();
}
run();
