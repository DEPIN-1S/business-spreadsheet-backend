import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

/**
 * ColumnPermission — defines which columns a specific user can see or edit in a sheet.
 * Admin and SuperAdmin bypass this model entirely.
 */
const ColumnPermission = sequelize.define("ColumnPermission", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    spreadsheetId: { type: DataTypes.UUID, allowNull: false },
    // columnAccess: { [colId]: "view" | "edit" }
    columnAccess: { type: DataTypes.JSON, defaultValue: {} }
}, {
    tableName: "column_permissions",
    indexes: [{ unique: true, fields: ["userId", "spreadsheetId"] }]
});

export default ColumnPermission;
