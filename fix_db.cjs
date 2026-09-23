
const mysql = require("mysql2/promise");
(async () => {
    const conn = await mysql.createConnection({
        host: "srv2203.hstgr.io",
        user: "u689598822_spreadsheetdb",
        password: "Shifa#clinic@123",
        database: "u689598822_spreadsheetdb"
    });
    
    for (const table of ["businesses", "templates", "spreadsheets", "SheetData", "SpreadsheetUsers"]) {
        try {
            console.log("Checking table:", table);
            const [rows] = await conn.execute(`SHOW INDEX FROM ${table}`);
            const indexNames = [...new Set(rows.map(r => r.Key_name))].filter(n => n !== "PRIMARY");
            console.log(`Found ${indexNames.length} indexes in ${table}.`);
            if (indexNames.length > 5) {
                for (const idx of indexNames) {
                    // Drop all custom indexes and let sequelize recreate them
                    console.log(`Dropping index ${idx} from ${table}`);
                    await conn.execute(`ALTER TABLE ${table} DROP INDEX \`${idx}\``);
                }
            }
        } catch (e) {
            console.log("Error on table " + table + ": " + e.message);
        }
    }
    
    conn.end();
})();

