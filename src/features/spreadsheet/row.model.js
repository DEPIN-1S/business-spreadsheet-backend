import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const Row = sequelize.define("Row", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    spreadsheetId: { type: DataTypes.UUID, allowNull: false },
    order: { type: DataTypes.INTEGER, defaultValue: 0 },
    rowColor: { type: DataTypes.STRING(20), allowNull: true },
    height: { type: DataTypes.INTEGER, defaultValue: 32 },
    isLocked: { type: DataTypes.BOOLEAN, defaultValue: false },
    isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
    tableName: "rows",
    indexes: [{ fields: ["spreadsheetId"] }, { fields: ["order"] }]
});

export default Row;
