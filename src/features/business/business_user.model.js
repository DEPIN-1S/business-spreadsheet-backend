import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const BusinessUser = sequelize.define("BusinessUser", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    businessId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false }
}, {
    tableName: "business_users",
    timestamps: true,
    indexes: [
        { unique: true, fields: ["businessId", "userId"] }
    ]
});

export default BusinessUser;
