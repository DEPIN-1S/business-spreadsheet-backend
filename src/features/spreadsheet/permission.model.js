import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const SheetPermission = sequelize.define("SheetPermission", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    spreadsheetId: { type: DataTypes.UUID, allowNull: false },
    role: { type: DataTypes.ENUM("viewer", "editor", "admin"), defaultValue: "viewer" },
    canView: { type: DataTypes.BOOLEAN, defaultValue: true },
    canEdit: { type: DataTypes.BOOLEAN, defaultValue: false },
    canEditFormulas: { type: DataTypes.BOOLEAN, defaultValue: false },
    restrictedColumns: { type: DataTypes.JSON, defaultValue: [] },
    invitedBy: { type: DataTypes.UUID, allowNull: true },
    virtualFolderId: { type: DataTypes.UUID, allowNull: true, defaultValue: null }
}, {
    tableName: "sheet_permissions",
    indexes: [
        { unique: true, fields: ["userId", "spreadsheetId"] },
        { fields: ["virtualFolderId"] }
    ]
});

export default SheetPermission;
