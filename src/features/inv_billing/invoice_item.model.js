import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const InvoiceItem = sequelize.define("InvoiceItem", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    invoiceId: { type: DataTypes.UUID, allowNull: false },
    invCcRowId: { type: DataTypes.UUID, allowNull: true },
    description: { type: DataTypes.STRING(300), allowNull: true },
    batch: { type: DataTypes.STRING(100), allowNull: true },
    qty: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    price: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    lineTotal: {
        type: DataTypes.VIRTUAL,
        get() { return (parseFloat(this.qty || 0) * parseFloat(this.price || 0)).toFixed(2); }
    },
    isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { tableName: "invoice_items" });

export default InvoiceItem;
