import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

// Each row in the main inventory spreadsheet = one product
const InvRow = sequelize.define("InvRow", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    spreadsheetId: { type: DataTypes.UUID, allowNull: false },
    orderIndex: { type: DataTypes.INTEGER, defaultValue: 0 },
    isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { tableName: "inv_rows" });

export default InvRow;
