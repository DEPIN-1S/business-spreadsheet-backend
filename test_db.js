import { Sequelize, DataTypes } from 'sequelize';

const sequelize = new Sequelize('u689598822_spreadsheetdb', 'u689598822_spreadsheetdb', 'Shifa#clinic@123', {
    host: 'srv2203.hstgr.io',
    dialect: 'mysql',
    logging: false
});

const Cell = sequelize.define('Cell', {
    rawValue: DataTypes.TEXT,
    computedValue: DataTypes.TEXT,
    formattedValue: DataTypes.TEXT
}, { tableName: 'cells', timestamps: false });

async function run() {
    try {
        const cells = await Cell.findAll({
            where: {
                [Sequelize.Op.or]: [
                    { rawValue: { [Sequelize.Op.like]: '%amlip%' } },
                    { computedValue: { [Sequelize.Op.like]: '%amlip%' } },
                    { formattedValue: { [Sequelize.Op.like]: '%amlip%' } }
                ]
            },
            limit: 5
        });
        console.log('Matches for amlip:', cells.length);
        cells.forEach(c => console.log(c.toJSON()));
    } catch (e) {
        console.error(e);
    } finally {
        sequelize.close();
    }
}
run();
