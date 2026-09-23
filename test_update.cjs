
const { Sequelize, DataTypes } = require("sequelize");
const db = new Sequelize("u689598822_spreadsheetdb", "u689598822_spreadsheetdb", "Shifa#clinic@123", {
    host: "srv2203.hstgr.io",
    dialect: "mysql",
    logging: false
});

const Spreadsheet = db.define("Spreadsheet", {
    id: { type: DataTypes.UUID, primaryKey: true },
    name: { type: DataTypes.STRING },
    visibleOnInvoiceGenerator: { type: DataTypes.BOOLEAN }
}, { tableName: "spreadsheets", timestamps: false });

(async () => {
    try {
        await db.authenticate();
        const sheet = await Spreadsheet.findOne({ where: { name: "CardioDiabetic_Medicine Rates_C.C" } });
        if (!sheet) {
            console.log("Sheet not found!");
            process.exit(1);
        }
        console.log("Found sheet:", sheet.id);
        await sheet.update({ visibleOnInvoiceGenerator: true });
        console.log("Update success!");
    } catch (e) {
        console.error("Error:", e);
    }
    process.exit(0);
})();

