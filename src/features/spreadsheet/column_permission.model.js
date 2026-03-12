import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

/**
 * ColumnPermission — defines which columns a specific user can see in a sheet.
 * Admin and SuperAdmin bypass this model entirely.
 */
const ColumnPermission = sequelize.define("ColumnPermission", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    sheetId: { type: DataTypes.UUID, allowNull: false },
    allowedColumnIds: { type: DataTypes.JSON, defaultValue: [] }  // array of column UUIDs
}, {
    tableName: "column_permissions",
    indexes: [{ unique: true, fields: ["userId", "sheetId"] }]
});

export default ColumnPermission;
