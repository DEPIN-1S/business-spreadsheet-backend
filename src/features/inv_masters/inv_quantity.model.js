import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const InvQuantityUnit = sequelize.define("InvQuantityUnit", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: "inv_quantity_units" });

export default InvQuantityUnit;
