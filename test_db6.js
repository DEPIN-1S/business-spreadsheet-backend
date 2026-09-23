import { Sequelize, DataTypes } from 'sequelize';
const sequelize = new Sequelize('u689598822_spreadsheetdb', 'u689598822_spreadsheetdb', 'Shifa#clinic@123', { host: 'srv2203.hstgr.io', dialect: 'mysql', logging: false });
const Cell = sequelize.define('Cell', { rawValue: DataTypes.TEXT, rowId: DataTypes.STRING, columnId: DataTypes.STRING }, { tableName: 'cells', timestamps: false });
const Row = sequelize.define('Row', { id: { type: DataTypes.STRING, primaryKey: true }, spreadsheetId: DataTypes.STRING }, { tableName: 'rows', timestamps: false });
Cell.belongsTo(Row, { foreignKey: 'rowId' });
async function run() {
    const cells = await Cell.findAll({
        where: { rawValue: { [Sequelize.Op.like]: '%amlip%' } },
        include: [{ model: Row, where: { spreadsheetId: ['2e9e6eec-a83c-4006-b26f-8f8bf0dbaddb', '362c1d2e-1d53-4c61-95f8-8c4d3fca4844'] } }]
    });
    console.log('Matches in invoice sheets:', cells.length);
    sequelize.close();
}
run();
