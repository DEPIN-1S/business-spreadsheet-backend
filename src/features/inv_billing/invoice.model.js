import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const Invoice = sequelize.define("Invoice", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    invoiceNo: { type: DataTypes.STRING(50), allowNull: true, unique: true },
    invoiceDate: { type: DataTypes.DATEONLY, allowNull: false },
    type: { type: DataTypes.ENUM("retail", "wholesale"), allowNull: false },
    partyId: { type: DataTypes.UUID, allowNull: true },
    partyType: { type: DataTypes.ENUM("retail", "wholesale"), allowNull: true },
    partyName: { type: DataTypes.STRING(200), allowNull: true }, // denormalized for display
    billingAddress: { type: DataTypes.TEXT, allowNull: true },   // denormalized billing address
    shippingAddress: { type: DataTypes.TEXT, allowNull: true },  // denormalized shipping address
    subtotal: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    taxAmount: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    itemSubtotal: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    discountAmount: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    additionalChargesAmount: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    additionalCharges: { type: DataTypes.JSON, allowNull: true },
    roundOffAmount: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    grandTotal: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    paymentMethod: {
        type: DataTypes.ENUM("Cash", "UPI", "Card", "Combined", "Bank"),
        allowNull: true
    },
    paymentStatus: {
        type: DataTypes.ENUM("Paid", "Unpaid", "Partially Paid"),
        defaultValue: "Unpaid"
    },
    pendingAmount: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    combinedUpiAmount: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    combinedCashAmount: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    notes: { type: DataTypes.TEXT, allowNull: true },
    createdBy: { type: DataTypes.UUID, allowNull: true },
    isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { tableName: "invoices" });

export default Invoice;
