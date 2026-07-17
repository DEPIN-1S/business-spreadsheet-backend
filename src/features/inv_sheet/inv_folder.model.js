import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const InvFolder = sequelize.define("InvFolder", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    title: { type: DataTypes.STRING(200), allowNull: false },
    parentId: { type: DataTypes.UUID, allowNull: true, defaultValue: null },
    createdBy: { type: DataTypes.UUID, allowNull: true },
    isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { tableName: "inv_folders" });

export default InvFolder;
