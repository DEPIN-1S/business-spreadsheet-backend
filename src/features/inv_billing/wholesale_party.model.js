import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const WholesaleParty = sequelize.define("WholesaleParty", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING(200), allowNull: false },
    registrationNo: { type: DataTypes.STRING(100), allowNull: true },
    contact: { type: DataTypes.STRING(20), allowNull: true },
    email: { type: DataTypes.STRING(150), allowNull: true },
    address: { type: DataTypes.TEXT, allowNull: true },
    isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { tableName: "wholesale_parties" });

export default WholesaleParty;
