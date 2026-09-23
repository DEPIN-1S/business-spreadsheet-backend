
const mysql = require("mysql2/promise");
(async () => {
    const conn = await mysql.createConnection({
        host: "srv2203.hstgr.io",
        user: "u689598822_spreadsheetdb",
        password: "Shifa#clinic@123",
        database: "u689598822_spreadsheetdb"
    });
    
    const [tables] = await conn.execute(`SHOW TABLES`);
    
    for (const tableObj of tables) {
        const table = Object.values(tableObj)[0];
        try {
            const [rows] = await conn.execute(`SHOW INDEX FROM \`${table}\``);
            const indexNames = [...new Set(rows.map(r => r.Key_name))].filter(n => n !== "PRIMARY");
            if (indexNames.length > 30) {
                console.log(`Table ${table} has ${indexNames.length} indexes! Dropping them...`);
                for (const idx of indexNames) {
                    await conn.execute(`ALTER TABLE \`${table}\` DROP INDEX \`${idx}\``);
                }
            }
        } catch (e) {
        }
    }
    
    console.log("Done checking all tables.");
    conn.end();
})();

