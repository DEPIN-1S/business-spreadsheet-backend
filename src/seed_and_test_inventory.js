import sequelize from "./config/db.js";
import {
    InvFolder, InvSpreadsheet, InvRow, InvCell,
    InvCcRow, InvCcCell, InvCcMeta,
    InvGstOption, InvCategory, InvDivision,
    InvManufacturer, InvCompany, InvQuantityUnit,
    RetailParty, WholesaleParty, Invoice, InvoiceItem, LedgerEntry
} from "./config/associations.js";

async function run() {
    console.log("Starting Inventory Seeding...");

    try {
        await sequelize.authenticate();
        console.log("Database connected successfully.");

        // Clear existing inventory dummy data to avoid duplicates (optional, just safety)
        console.log("Cleaning old test data...");
        await InvSpreadsheet.destroy({ where: {} }).catch(() => {});
        await InvFolder.destroy({ where: {} }).catch(() => {});
        await RetailParty.destroy({ where: {} }).catch(() => {});
        await WholesaleParty.destroy({ where: {} }).catch(() => {});
        await Invoice.destroy({ where: {} }).catch(() => {});
        await LedgerEntry.destroy({ where: {} }).catch(() => {});

        // 1. Seed Masters
        console.log("Seeding Master Dropdowns...");
        const gstValues = ["GST 5%", "GST 12%", "GST 18%", "GST 28%"];
        for (const val of gstValues) {
            await InvGstOption.findOrCreate({ where: { value: val } });
        }
        const categories = ["Tablet", "Syrup", "Capsule", "Ointment", "Drops", "Injection"];
        for (const cat of categories) {
            await InvCategory.findOrCreate({ where: { name: cat } });
        }
        const divisions = ["General", "Cardiac", "Diabetic", "Pediatric"];
        for (const div of divisions) {
            await InvDivision.findOrCreate({ where: { name: div } });
        }
        const manufacturers = ["Sun Pharma", "Cipla", "Abbott", "GlaxoSmithKline"];
        for (const mfg of manufacturers) {
            await InvManufacturer.findOrCreate({ where: { name: mfg } });
        }
        const companies = ["GSK Ltd", "Cipla India", "Sun Labs", "Abbott India"];
        for (const co of companies) {
            await InvCompany.findOrCreate({ where: { name: co } });
        }
        const units = ["Strips of 10", "Strips of 15", "100ml Bottle", "Vial"];
        for (const unit of units) {
            await InvQuantityUnit.findOrCreate({ where: { name: unit } });
        }

        // 2. Seed Folders & Spreadsheets
        console.log("Seeding Folders and Sheets...");
        const folder = await InvFolder.create({
            title: "Main Warehouse Stock",
            parentId: null
        });

        const sheet = await InvSpreadsheet.create({
            name: "Warehouse A Stocklist",
            sku: "INV-SKU-WA101",
            folderId: folder.id,
            settings: {}
        });

        // 3. Seed Products (Main Rows)
        console.log("Seeding Products (Rows)...");
        
        // Product 1: Limcee
        const row1 = await InvRow.create({ spreadsheetId: sheet.id, orderIndex: 0 });
        const p1Cells = [
            { rowId: row1.id, columnId: "col-product-image", rawValue: "" },
            { rowId: row1.id, columnId: "col-product-name", rawValue: "Limcee Chewable Vitamin C" },
            { rowId: row1.id, columnId: "col-composition", rawValue: "Vitamin C 500mg" },
            { rowId: row1.id, columnId: "col-company-name", rawValue: "Abbott India" },
            { rowId: row1.id, columnId: "col-manufacturer", rawValue: "Abbott" },
            { rowId: row1.id, columnId: "col-hsn-code", rawValue: "300450" },
            { rowId: row1.id, columnId: "col-retail-inventory", rawValue: "5" }
        ];
        await InvCell.bulkCreate(p1Cells);

        await InvCcMeta.create({
            rowId: row1.id,
            gst: "GST 5%",
            category: "Tablet",
            division: "Pediatric",
            manufacturer: "Abbott",
            companyName: "Abbott India",
            quantity: "Strips of 15"
        });

        // Limcee Batches (CC Rows)
        const p1CcRow1 = await InvCcRow.create({ parentRowId: row1.id, orderIndex: 0 });
        const p1CcRow1Cells = [
            { ccRowId: p1CcRow1.id, columnId: "col-cc-batch", rawValue: "LM9900C" },
            { ccRowId: p1CcRow1.id, columnId: "col-cc-quantity-stock", rawValue: "5" },
            { ccRowId: p1CcRow1.id, columnId: "col-cc-expiry-date", rawValue: "2029-06-10" },
            { ccRowId: p1CcRow1.id, columnId: "col-cc-purchase-rate", rawValue: "30.00" },
            { ccRowId: p1CcRow1.id, columnId: "col-cc-retail-profit", rawValue: "10.00" },
            { ccRowId: p1CcRow1.id, columnId: "col-cc-retail-selling-rate", rawValue: "40.00" },
            { ccRowId: p1CcRow1.id, columnId: "col-cc-wholesale-profit", rawValue: "7.00" },
            { ccRowId: p1CcRow1.id, columnId: "col-cc-wholesale-selling-rate", rawValue: "37.00" },
            { ccRowId: p1CcRow1.id, columnId: "col-cc-discount", rawValue: "0" },
            { ccRowId: p1CcRow1.id, columnId: "col-cc-mrp", rawValue: "45.00" },
            { ccRowId: p1CcRow1.id, columnId: "col-cc-status", rawValue: "Low Stock" },
            { ccRowId: p1CcRow1.id, columnId: "col-cc-quantity-notified", rawValue: "20" }
        ];
        await InvCcCell.bulkCreate(p1CcRow1Cells);


        // Product 2: Dolo
        const row2 = await InvRow.create({ spreadsheetId: sheet.id, orderIndex: 1 });
        const p2Cells = [
            { rowId: row2.id, columnId: "col-product-image", rawValue: "" },
            { rowId: row2.id, columnId: "col-product-name", rawValue: "Dolo 650mg Tablet" },
            { rowId: row2.id, columnId: "col-composition", rawValue: "Paracetamol 650mg" },
            { rowId: row2.id, columnId: "col-company-name", rawValue: "Micro Labs Ltd" },
            { rowId: row2.id, columnId: "col-manufacturer", rawValue: "Micro Labs" },
            { rowId: row2.id, columnId: "col-hsn-code", rawValue: "300490" },
            { rowId: row2.id, columnId: "col-retail-inventory", rawValue: "150" }
        ];
        await InvCell.bulkCreate(p2Cells);

        await InvCcMeta.create({
            rowId: row2.id,
            gst: "GST 12%",
            category: "Tablet",
            division: "General",
            manufacturer: "Micro Labs",
            companyName: "GSK Ltd",
            quantity: "Strips of 15"
        });

        // Dolo Batches (CC Rows)
        const p2CcRow1 = await InvCcRow.create({ parentRowId: row2.id, orderIndex: 0 });
        const p2CcRow1Cells = [
            { ccRowId: p2CcRow1.id, columnId: "col-cc-batch", rawValue: "DL2026A" },
            { ccRowId: p2CcRow1.id, columnId: "col-cc-quantity-stock", rawValue: "150" },
            { ccRowId: p2CcRow1.id, columnId: "col-cc-expiry-date", rawValue: "2028-08-15" },
            { ccRowId: p2CcRow1.id, columnId: "col-cc-purchase-rate", rawValue: "25.00" },
            { ccRowId: p2CcRow1.id, columnId: "col-cc-retail-profit", rawValue: "5.50" },
            { ccRowId: p2CcRow1.id, columnId: "col-cc-retail-selling-rate", rawValue: "30.50" },
            { ccRowId: p2CcRow1.id, columnId: "col-cc-wholesale-profit", rawValue: "3.50" },
            { ccRowId: p2CcRow1.id, columnId: "col-cc-wholesale-selling-rate", rawValue: "28.50" },
            { ccRowId: p2CcRow1.id, columnId: "col-cc-discount", rawValue: "0" },
            { ccRowId: p2CcRow1.id, columnId: "col-cc-mrp", rawValue: "35.00" },
            { ccRowId: p2CcRow1.id, columnId: "col-cc-status", rawValue: "Stock Available" },
            { ccRowId: p2CcRow1.id, columnId: "col-cc-quantity-notified", rawValue: "20" }
        ];
        await InvCcCell.bulkCreate(p2CcRow1Cells);

        // 4. Seed Parties
        console.log("Seeding Parties...");
        const p1 = await RetailParty.create({
            name: "John Doe (Walk-in)",
            contact: "+1 (555) 111-2233",
            email: "johndoe@email.com",
            address: "12 Maple St, NY"
        });
        const p2 = await WholesaleParty.create({
            name: "Acme Wholesale Corp",
            contact: "+1 (555) 123-4567",
            email: "billing@acmewholesale.com",
            registrationNo: "REG-998877",
            address: "123 Market Street, NY"
        });

        // 5. Seed Invoices & Ledger Entries
        console.log("Seeding Sample Invoices...");
        const retInvoice = await Invoice.create({
            invoiceNo: "INV-RET-2026-001",
            invoiceDate: "2026-07-15",
            type: "retail",
            partyId: p1.id,
            partyType: "retail",
            partyName: p1.name,
            subtotal: 345.00,
            taxAmount: 0.00,
            grandTotal: 345.00,
            paymentMethod: "UPI",
            paymentStatus: "Paid",
            pendingAmount: 0.00,
            notes: "Sample Retail Bill"
        });

        await InvoiceItem.bulkCreate([
            {
                invoiceId: retInvoice.id,
                invCcRowId: p1CcRow1.id,
                description: "Limcee Chewable Vitamin C",
                batch: "LM9900C",
                qty: 1,
                price: 40.00
            },
            {
                invoiceId: retInvoice.id,
                invCcRowId: p2CcRow1.id,
                description: "Dolo 650mg Tablet",
                batch: "DL2026A",
                qty: 10,
                price: 30.50
            }
        ]);

        // Adjust batch stock for retail invoice (5 - 1 = 4; 150 - 10 = 140)
        const limceeStockCell = await InvCcCell.findOne({ where: { ccRowId: p1CcRow1.id, columnId: "col-cc-quantity-stock" } });
        if (limceeStockCell) {
            await limceeStockCell.update({ rawValue: "4" });
        }
        const doloStockCell = await InvCcCell.findOne({ where: { ccRowId: p2CcRow1.id, columnId: "col-cc-quantity-stock" } });
        if (doloStockCell) {
            await doloStockCell.update({ rawValue: "140" });
        }

        const whInvoice = await Invoice.create({
            invoiceNo: "INV-WH-2026-001",
            invoiceDate: "2026-07-15",
            type: "wholesale",
            partyId: p2.id,
            partyType: "wholesale",
            partyName: p2.name,
            subtotal: 1425.00,
            taxAmount: 0.00,
            grandTotal: 1425.00,
            paymentMethod: "Bank",
            paymentStatus: "Unpaid",
            pendingAmount: 1425.00,
            notes: "Sample Wholesale Bill"
        });

        await InvoiceItem.create({
            invoiceId: whInvoice.id,
            invCcRowId: p2CcRow1.id,
            description: "Dolo 650mg Tablet",
            batch: "DL2026A",
            qty: 50,
            price: 28.50
        });

        // Adjust batch stock for wholesale invoice (140 - 50 = 90)
        if (doloStockCell) {
            await doloStockCell.update({ rawValue: "90" });
        }

        // Create Ledger Entry for unpaid wholesale bill
        await LedgerEntry.create({
            invoiceId: whInvoice.id,
            invoiceNo: "INV-WH-2026-001",
            type: "Wholesale",
            customerName: p2.name,
            phone: p2.contact,
            date: "2026-07-15",
            pendingAmount: 1425.00,
            status: "Pending"
        });

        // Synchronize parent main sheet cells to match adjusted batch stock totals (4 and 90)
        const limceeMainCell = await InvCell.findOne({ where: { rowId: row1.id, columnId: "col-retail-inventory" } });
        if (limceeMainCell) {
            await limceeMainCell.update({ rawValue: "4" });
        }
        const doloMainCell = await InvCell.findOne({ where: { rowId: row2.id, columnId: "col-retail-inventory" } });
        if (doloMainCell) {
            await doloMainCell.update({ rawValue: "90" });
        }

        console.log("Inventory Seeding Completed successfully!");
        process.exit(0);
    } catch (e) {
        console.error("Seeding failed:", e);
        process.exit(1);
    }
}

run();
