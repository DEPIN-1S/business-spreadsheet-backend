import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const InvDivision = sequelize.define("InvDivision", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING(150), allowNull: false, unique: true },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: "inv_divisions" });

export default InvDivision;
