import { Sequelize, DataTypes } from 'sequelize';
const sequelize = new Sequelize('u689598822_spreadsheetdb', 'u689598822_spreadsheetdb', 'Shifa#clinic@123', { host: 'srv2203.hstgr.io', dialect: 'mysql', logging: false });
const Spreadsheet = sequelize.define('Spreadsheet', { name: DataTypes.STRING, visibleOnInvoiceGenerator: DataTypes.BOOLEAN }, { tableName: 'spreadsheets', timestamps: false });
async function run() {
    const sheets = await Spreadsheet.findAll({ where: { visibleOnInvoiceGenerator: true } });
    console.log('Invoice sheets:', sheets.length);
    sheets.slice(0, 2).forEach(s => console.log(s.toJSON()));
    sequelize.close();
}
run();
