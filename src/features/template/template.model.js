import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const Template = sequelize.define("Template", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    businessId: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    isProductBased: { type: DataTypes.BOOLEAN, defaultValue: true },
isB2B: { type: DataTypes.BOOLEAN, defaultValue: false },
    columns: { type: DataTypes.JSON, defaultValue: [] },
    spreadsheetId: { type: DataTypes.UUID, allowNull: true },
    spreadsheetIds: { type: DataTypes.JSON, allowNull: true },
    signatureImage: { type: DataTypes.TEXT('long'), allowNull: true },
}, {
    tableName: "templates",
    indexes: [{ fields: ["businessId"] }]
});

export default Template;


