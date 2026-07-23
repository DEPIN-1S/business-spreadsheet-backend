import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const RetailParty = sequelize.define("RetailParty", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING(200), allowNull: false },
    registrationNo: { type: DataTypes.TEXT, allowNull: true },
    dlNo: { type: DataTypes.STRING(100), allowNull: true },
    gstinNo: { type: DataTypes.STRING(100), allowNull: true },
    panNo: { type: DataTypes.STRING(100), allowNull: true },
    dobYear: { type: DataTypes.INTEGER, allowNull: true },
    age: { type: DataTypes.INTEGER, allowNull: true },
    contact: { type: DataTypes.STRING(20), allowNull: true },
    email: { type: DataTypes.STRING(150), allowNull: true },
    address: { type: DataTypes.TEXT, allowNull: true },
    isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { tableName: "retail_parties" });

export default RetailParty;
