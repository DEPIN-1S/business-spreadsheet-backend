import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const SavedInvoice = sequelize.define("SavedInvoice", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    invoiceNo: { type: DataTypes.STRING(100), allowNull: true },
    templateName: { type: DataTypes.STRING(200), allowNull: true },
    date: { type: DataTypes.STRING(50), allowNull: true },
    time: { type: DataTypes.STRING(50), allowNull: true },
    partyName: { type: DataTypes.STRING(200), allowNull: true },
    total: { type: DataTypes.STRING(50), allowNull: true },
    grandTotal: { type: DataTypes.STRING(50), allowNull: true },
    fullData: { type: DataTypes.JSON, allowNull: true }, // The heavy JSON blob
    createdBy: { type: DataTypes.UUID, allowNull: true }, // User ID
    businessId: { type: DataTypes.UUID, allowNull: true } // Business it belongs to
}, { tableName: "saved_invoices" });

export default SavedInvoice;
