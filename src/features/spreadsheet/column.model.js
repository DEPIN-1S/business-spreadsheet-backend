import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

/**
 * Column model — supports all Datarithm column types and visual properties.
 * Types: text | number | image | video | formula | comment
 */
const Column = sequelize.define("Column", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    spreadsheetId: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    type: {
        type: DataTypes.ENUM("text", "number", "image", "video", "formula", "comment", "date", "dropdown", "currency", "multi_image", "pdf"),
        defaultValue: "text"
    },
    currencyCode: { type: DataTypes.STRING(3), allowNull: true, defaultValue: null },
    orderIndex: { type: DataTypes.INTEGER, defaultValue: 0 },
    defaultValue: { type: DataTypes.TEXT, allowNull: true },
    alignment: { type: DataTypes.ENUM("left", "center", "right"), defaultValue: "left" },
    width: { type: DataTypes.INTEGER, defaultValue: 150 },
    textColor: { type: DataTypes.STRING(20), allowNull: true },
    bgColor: { type: DataTypes.STRING(20), allowNull: true },
    isBold: { type: DataTypes.BOOLEAN, defaultValue: false },
    isItalic: { type: DataTypes.BOOLEAN, defaultValue: false },
    isHidden: { type: DataTypes.BOOLEAN, defaultValue: false },
    isLocked: { type: DataTypes.BOOLEAN, defaultValue: false },
    options: { type: DataTypes.JSON, defaultValue: [] },           // for dropdown choices
    validationRules: { type: DataTypes.JSON, defaultValue: {} },   // {required, min, max, regex}
    formulaExpr: { type: DataTypes.TEXT, allowNull: true },        // =SUM(A1:A10) etc.
    isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
    tableName: "columns",
    indexes: [{ fields: ["spreadsheetId"] }, { fields: ["orderIndex"] }]
});

export default Column;
