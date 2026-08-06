import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const LedgerEntry = sequelize.define("LedgerEntry", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    invoiceId: { type: DataTypes.UUID, allowNull: true },
    invoiceNo: { type: DataTypes.STRING(50), allowNull: true },
    type: { type: DataTypes.ENUM("Retail", "Wholesale"), allowNull: false },
    customerName: { type: DataTypes.STRING(200), allowNull: true },
    phone: { type: DataTypes.STRING(20), allowNull: true },
    date: { type: DataTypes.DATEONLY, allowNull: true },
    pendingAmount: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    status: {
        type: DataTypes.ENUM("Pending", "Settled", "Partially Paid"),
        defaultValue: "Pending"
    },
    createdBy: { type: DataTypes.UUID, allowNull: true },
    isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { tableName: "ledger_entries" });

export default LedgerEntry;
