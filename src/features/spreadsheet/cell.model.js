import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const Cell = sequelize.define("Cell", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    rowId: { type: DataTypes.UUID, allowNull: false },
    columnId: { type: DataTypes.UUID, allowNull: false },
    rawValue: { type: DataTypes.TEXT, allowNull: true },       // user-entered value
    formattedValue: { type: DataTypes.TEXT, allowNull: true }, // display-ready value
    computedValue: { type: DataTypes.TEXT, allowNull: true },  // formula-evaluated value
    bgColor: { type: DataTypes.STRING, allowNull: true },      // background color
    isBold: { type: DataTypes.BOOLEAN, defaultValue: false },
    isItalic: { type: DataTypes.BOOLEAN, defaultValue: false },
    currencyCode: { type: DataTypes.STRING(3), allowNull: true, defaultValue: null },
    fileUrl: { type: DataTypes.STRING, allowNull: true },      // for image/video columns
    updatedBy: { type: DataTypes.UUID, allowNull: true },
    nestedSheetId: { type: DataTypes.UUID, allowNull: true },
    isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
    tableName: "cells",
    indexes: [
        { unique: true, fields: ["rowId", "columnId"] },
        { fields: ["rowId"] },
        { fields: ["columnId"] }
    ]
});

export default Cell;
