import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

/**
 * Stores cell values for the main inventory columns:
 * col-product-image | col-product-name | col-retail-inventory |
 * col-composition   | col-company-name | col-rack-no
 */
const InvCell = sequelize.define("InvCell", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    rowId: { type: DataTypes.UUID, allowNull: false },
    // columnId is one of the 7 predefined constant IDs — stored as string
    columnId: { type: DataTypes.STRING(50), allowNull: false },
    rawValue: { type: DataTypes.TEXT, allowNull: true, defaultValue: "" },
    computedValue: { type: DataTypes.TEXT, allowNull: true, defaultValue: "" }
}, {
    tableName: "inv_cells",
    indexes: [
        { unique: true, fields: ["rowId", "columnId"] }
    ]
});

export default InvCell;
