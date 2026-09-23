import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const BusinessParty = sequelize.define("BusinessParty", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    businessId: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    billingAddress: { type: DataTypes.TEXT, allowNull: true },
    shippingAddress: { type: DataTypes.TEXT, allowNull: true },
    contact: { type: DataTypes.STRING, allowNull: true },
    email: { type: DataTypes.STRING, allowNull: true },
    dlNo: { type: DataTypes.STRING, allowNull: true },
    gstin: { type: DataTypes.STRING, allowNull: true },
    pan: { type: DataTypes.STRING, allowNull: true },
    age: { type: DataTypes.STRING, allowNull: true },
    gender: { type: DataTypes.STRING, allowNull: true },
    ageLastUpdatedYear: { type: DataTypes.INTEGER, allowNull: true },
    additionalData: { type: DataTypes.JSON, defaultValue: [] },
    isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
    tableName: "business_parties",
    indexes: [{ fields: ["businessId"] }]
});

export default BusinessParty;
