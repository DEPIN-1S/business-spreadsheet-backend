import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const Column = sequelize.define("Column", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    spreadsheetId: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    type: {
        type: DataTypes.ENUM("text", "number", "date", "dropdown", "formula", "file"),
        defaultValue: "text"
    },
    order: { type: DataTypes.INTEGER, defaultValue: 0 },
    options: { type: DataTypes.JSON, defaultValue: [] },       // for dropdown choices
    validationRules: { type: DataTypes.JSON, defaultValue: {} }, // {required, min, max, regex}
    formulaExpr: { type: DataTypes.TEXT, allowNull: true },    // =SUM(A1:A10) etc.
    isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { tableName: "columns" });

export default Column;
