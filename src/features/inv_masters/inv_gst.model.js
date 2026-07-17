import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const InvGstOption = sequelize.define("InvGstOption", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    value: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: "inv_gst_options" });

export default InvGstOption;
