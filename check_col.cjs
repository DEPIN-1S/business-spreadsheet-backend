
const mysql = require("mysql2/promise");
(async () => {
    const conn = await mysql.createConnection({
        host: "srv2203.hstgr.io",
        user: "u689598822_spreadsheetdb",
        password: "Shifa#clinic@123",
        database: "u689598822_spreadsheetdb"
    });
    
    try {
        const [rows] = await conn.execute("SHOW COLUMNS FROM spreadsheets LIKE 'visibleOnInvoiceGenerator'");
        console.log("Found:", rows.length > 0);
    } catch (e) { console.log(e.message); }
    conn.end();
})();

