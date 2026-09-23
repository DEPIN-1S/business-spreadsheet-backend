import { Sequelize, DataTypes } from 'sequelize';
const sequelize = new Sequelize('u689598822_spreadsheetdb', 'u689598822_spreadsheetdb', 'Shifa#clinic@123', { host: 'srv2203.hstgr.io', dialect: 'mysql', logging: false });
const Cell = sequelize.define('Cell', { rawValue: DataTypes.TEXT, spreadsheetId: DataTypes.STRING }, { tableName: 'cells', timestamps: false });
const Spreadsheet = sequelize.define('Spreadsheet', { name: DataTypes.STRING, visibleOnInvoiceGenerator: DataTypes.BOOLEAN }, { tableName: 'spreadsheets', timestamps: false });
Cell.belongsTo(Spreadsheet, { foreignKey: 'spreadsheetId' });

async function run() {
    const cells = await Cell.findAll({
        where: { rawValue: { [Sequelize.Op.like]: '%amlip%' } },
        include: [{ model: Spreadsheet, where: { visibleOnInvoiceGenerator: true } }]
    });
    console.log('Matches for amlip in visible sheets:', cells.length);
    sequelize.close();
}
run();
