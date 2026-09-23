import { Sequelize, DataTypes } from 'sequelize';
import jwt from 'jsonwebtoken';

const sequelize = new Sequelize('u689598822_spreadsheetdb', 'u689598822_spreadsheetdb', 'Shifa#clinic@123', { host: 'srv2203.hstgr.io', dialect: 'mysql', logging: false });
const User = sequelize.define('User', { id: { type: DataTypes.STRING, primaryKey: true }, role: DataTypes.STRING }, { tableName: 'users', timestamps: false });

async function run() {
    const user = await User.findOne({ where: { role: 'admin' } });
    if (!user) { console.log('no admin found'); return; }
    const token = jwt.sign({ id: user.id, role: user.role }, 'dkjghkdghfhglknghdxlkdnflsfjopoijoigjhpokp', { expiresIn: '1h' });
    
    // fetch sheets
    const sheetsRes = await fetch('http://localhost:6041/api/sheets?forInvoiceGenerator=true', { headers: { Authorization: 'Bearer ' + token } });
    const sheetsData = await sheetsRes.json();
    const sheets = sheetsData.data?.files || [];
    console.log('Found sheets:', sheets.length);
    
    if (sheets.length > 0) {
        const sheetId = sheets[0].id;
        const dataRes = await fetch('http://localhost:6041/api/sheets/' + sheetId + '/data?search=amlip', { headers: { Authorization: 'Bearer ' + token } });
        const data = await dataRes.json();
        console.log('Data rows:', data.data?.rows?.length);
        console.log('Data columns:', data.data?.columns?.length);
        console.log('Data cells:', data.data?.cells?.length);
        
        // Let's do the exact frontend logic:
        let allParsedData = [];
        const { columns = [], rows = [], cells = [] } = data.data;
        const parsedData = rows.map(row => {
            const rowData = {};
            columns.forEach(col => {
                const cell = cells.find(c => c.rowId === row.id && c.columnId === col.id);
                let colName = col.name.trim();
                const upperColName = colName.toUpperCase();
                
                if (upperColName === "GST%" || upperColName === "GST") colName = "GST";
                else if (upperColName === "PRODUCT NAME") colName = "Product Name";
                else if (upperColName === "MRP") colName = "MRP";
                else if (upperColName === "DISCOUNT") colName = "Discount";
                else if (upperColName === "SELLING RATE") colName = "Selling Rate";
                
                rowData[colName] = cell ? (cell.computedValue || cell.rawValue || '') : '';
            });
            return rowData;
        });
        allParsedData = [...allParsedData, ...parsedData];
        allParsedData = allParsedData.filter(d => d['Product Name']);
        console.log('Final parsed data length:', allParsedData.length);
        if (allParsedData.length > 0) console.log(allParsedData[0]);
    }
    
    sequelize.close();
}
run();
