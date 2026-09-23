import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const Business = sequelize.define("Business", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    isProductBased: { type: DataTypes.BOOLEAN, defaultValue: true },
    columns: { type: DataTypes.JSON, defaultValue: [] },
    spreadsheetId: { type: DataTypes.UUID, allowNull: true },
    logo: { type: DataTypes.TEXT("long"), allowNull: true },
    additionalData: { type: DataTypes.JSON, defaultValue: [] },
    seals: { type: DataTypes.JSON, defaultValue: [] },
    createdBy: { type: DataTypes.UUID, allowNull: false },
    isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
    tableName: "businesses",
    indexes: [{ fields: ["createdBy"] }]
});

export default Business;
