import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

/**
 * FolderPermission — controls per-user access to a folder and its contents.
 */
const FolderPermission = sequelize.define("FolderPermission", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    folderId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    canView: { type: DataTypes.BOOLEAN, defaultValue: true },
    canEdit: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
    tableName: "folder_permissions",
    indexes: [
        { unique: true, fields: ["folderId", "userId"] }
    ]
});

export default FolderPermission;
