import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

/**
 * Folder model — unlimited depth via self-referencing parentId.
 * Both folders and sheets can live inside a folder.
 */
const Folder = sequelize.define("Folder", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    parentId: { type: DataTypes.UUID, allowNull: true, defaultValue: null },
    createdBy: { type: DataTypes.UUID, allowNull: false },
    category: { type: DataTypes.ENUM("personal", "shared_org"), defaultValue: "personal" },
    isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
    tableName: "folders",
    indexes: [
        { fields: ["parentId"] },
        { fields: ["createdBy"] },
        { fields: ["category"] }
    ]
});

export default Folder;
