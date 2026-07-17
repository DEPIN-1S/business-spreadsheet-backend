import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const InvCategory = sequelize.define("InvCategory", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING(150), allowNull: false, unique: true },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: "inv_categories" });

export default InvCategory;
