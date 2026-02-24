import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const Cell = sequelize.define("Cell", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    rowId: { type: DataTypes.UUID, allowNull: false },
    columnId: { type: DataTypes.UUID, allowNull: false },
    rawValue: { type: DataTypes.TEXT, allowNull: true },       // user-entered value
    computedValue: { type: DataTypes.TEXT, allowNull: true },  // formula result
    fileUrl: { type: DataTypes.STRING, allowNull: true },      // for file-type columns
    updatedBy: { type: DataTypes.UUID, allowNull: true }
}, {
    tableName: "cells",
    indexes: [{ unique: true, fields: ["rowId", "columnId"] }]
});

export default Cell;
