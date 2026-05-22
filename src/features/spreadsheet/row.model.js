import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const Row = sequelize.define("Row", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    spreadsheetId: { type: DataTypes.UUID, allowNull: false },
    order: { type: DataTypes.INTEGER, defaultValue: 0 },
    rowColor: { type: DataTypes.STRING(20), allowNull: true },
    isBold: { type: DataTypes.BOOLEAN, defaultValue: false },
    isItalic: { type: DataTypes.BOOLEAN, defaultValue: false },
    isUnderline: { type: DataTypes.BOOLEAN, defaultValue: false },
    isStrikethrough: { type: DataTypes.BOOLEAN, defaultValue: false },
    fontFamily: { type: DataTypes.STRING(30), allowNull: true, defaultValue: null },
    alignment: { type: DataTypes.ENUM("left", "center", "right"), allowNull: true, defaultValue: null },
    nestedSheetId: { type: DataTypes.UUID, allowNull: true },
    height: { type: DataTypes.INTEGER, defaultValue: 32 },
    isLocked: { type: DataTypes.BOOLEAN, defaultValue: false },
    isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
    tableName: "rows",
    indexes: [{ fields: ["spreadsheetId"] }, { fields: ["order"] }]
});

export default Row;
