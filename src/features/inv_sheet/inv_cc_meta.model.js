import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

/**
 * Stores metadata values per product row (Sub-Spreadsheet View header).
 * One record per inv_row — linked by rowId (unique).
 * Fields: GST, Category, Division, Mfg (manufacturer), Company, Quantity, HSN Code, Rack No
 */
const InvCcMeta = sequelize.define("InvCcMeta", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    rowId: { type: DataTypes.UUID, allowNull: false, unique: true },
    gst: { type: DataTypes.STRING(100), allowNull: true, defaultValue: null },
    category: { type: DataTypes.STRING(100), allowNull: true, defaultValue: null },
    division: { type: DataTypes.STRING(100), allowNull: true, defaultValue: null },
    manufacturer: { type: DataTypes.STRING(100), allowNull: true, defaultValue: null }, // Mfg field
    companyName: { type: DataTypes.STRING(100), allowNull: true, defaultValue: null },   // Company field
    quantity: { type: DataTypes.STRING(100), allowNull: true, defaultValue: null },
    hsnCode: { type: DataTypes.STRING(100), allowNull: true, defaultValue: null },
    rackNo: { type: DataTypes.STRING(100), allowNull: true, defaultValue: null }
}, { tableName: "inv_cc_meta" });

export default InvCcMeta;
