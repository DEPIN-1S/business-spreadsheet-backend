import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const InventoryItem = sequelize.define("InventoryItem", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    spreadsheetId: { type: DataTypes.UUID, allowNull: true },   // optionally linked to a sheet
    name: { type: DataTypes.STRING, allowNull: false },
    sku: { type: DataTypes.STRING, allowNull: true, unique: true },
    category: { type: DataTypes.STRING, allowNull: true },
    quantity: { type: DataTypes.DECIMAL(15, 4), defaultValue: 0 },
    costPerUnit: { type: DataTypes.DECIMAL(15, 4), defaultValue: 0 },
    totalValue: {
        type: DataTypes.VIRTUAL,
        get() { return (parseFloat(this.quantity) * parseFloat(this.costPerUnit)).toFixed(4); }
    },
    location: { type: DataTypes.STRING, allowNull: true },
    minStock: { type: DataTypes.DECIMAL(15, 4), defaultValue: 0 },
    unit: { type: DataTypes.STRING, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { tableName: "inventory_items" });

export default InventoryItem;
