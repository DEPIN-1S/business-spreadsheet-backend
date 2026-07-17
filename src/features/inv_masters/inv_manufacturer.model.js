import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const InvManufacturer = sequelize.define("InvManufacturer", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING(200), allowNull: false, unique: true },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: "inv_manufacturers" });

export default InvManufacturer;
