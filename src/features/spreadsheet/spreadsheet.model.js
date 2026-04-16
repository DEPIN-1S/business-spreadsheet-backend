import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const Spreadsheet = sequelize.define("Spreadsheet", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    folderId: { type: DataTypes.UUID, allowNull: true, defaultValue: null },
    createdBy: { type: DataTypes.UUID, allowNull: false },
    settings: { type: DataTypes.JSON, defaultValue: {} },
    isDetailedView: { type: DataTypes.BOOLEAN, defaultValue: false },
    isLocked: { type: DataTypes.BOOLEAN, defaultValue: false },
    isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
    tableName: "spreadsheets",
    indexes: [{ fields: ["folderId"] }, { fields: ["createdBy"] }]
});

export default Spreadsheet;
