import sequelize from "./config/db.js";
import Invoice from "./features/inv_billing/invoice.model.js";
import InvoiceItem from "./features/inv_billing/invoice_item.model.js";
import InvCcCell from "./features/inv_sheet/inv_cc_cell.model.js";
import "./config/associations.js";

async function test() {
    try {
        await sequelize.authenticate();
        console.log("DB connected OK");

        const invoices = await Invoice.findAll({
            where: { isDeleted: false },
            include: [{ model: InvoiceItem, as: "items" }],
            limit: 5
        });

        for (const inv of invoices) {
            console.log(`\n--- Invoice ${inv.invoiceNo} (Type: ${inv.type}) ---`);
            const plainInv = inv.get({ plain: true });

            if (Array.isArray(plainInv.items)) {
                for (const item of plainInv.items) {
                    let val = parseFloat(item.disPercent || 0);
                    if (val === 0 && item.invCcRowId) {
                        const targetCol = plainInv.type === 'wholesale' ? 'col-cc-wholesale-margin' : 'col-cc-discount';
                        const valCell = await InvCcCell.findOne({
                            where: { ccRowId: item.invCcRowId, columnId: targetCol }
                        });
                        if (valCell && valCell.rawValue) {
                            val = parseFloat(valCell.rawValue) || 0;
                        }
                    }

                    if (val === 0 && parseFloat(item.mrp || 0) > 0 && parseFloat(item.price || 0) > 0) {
                        const mrpNum = parseFloat(item.mrp);
                        const priceNum = parseFloat(item.price);
                        if (plainInv.type === 'wholesale') {
                            val = ((mrpNum - priceNum) / priceNum) * 100;
                        } else {
                            val = ((mrpNum - priceNum) / mrpNum) * 100;
                        }
                    }

                    console.log(`  Item: ${item.description} | Price: ${item.price} | MRP: ${item.mrp} | Computed Margin/Disc %: ${val.toFixed(2)}%`);
                }
            }
        }

    } catch (err) {
        console.error("Test error:", err);
    } finally {
        await sequelize.close();
    }
}

test();
