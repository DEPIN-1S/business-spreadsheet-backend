import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const Row = sequelize.define("Row", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    spreadsheetId: { type: DataTypes.UUID, allowNull: false },
    order: { type: DataTypes.INTEGER, defaultValue: 0 },
    isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { tableName: "rows" });

export default Row;
