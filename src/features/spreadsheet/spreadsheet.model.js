import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const Spreadsheet = sequelize.define("Spreadsheet", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    createdBy: { type: DataTypes.UUID, allowNull: false },
    settings: { type: DataTypes.JSON, defaultValue: {} },
    isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { tableName: "spreadsheets" });

export default Spreadsheet;
