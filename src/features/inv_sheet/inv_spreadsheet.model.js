import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const InvSpreadsheet = sequelize.define("InvSpreadsheet", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING(200), allowNull: false },
    sku: { type: DataTypes.STRING(100), allowNull: true, unique: true },
    folderId: { type: DataTypes.UUID, allowNull: true, defaultValue: null },
    settings: { type: DataTypes.JSON, allowNull: true, defaultValue: {} },
    createdBy: { type: DataTypes.UUID, allowNull: true },
    isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { tableName: "inv_spreadsheets" });

export default InvSpreadsheet;
