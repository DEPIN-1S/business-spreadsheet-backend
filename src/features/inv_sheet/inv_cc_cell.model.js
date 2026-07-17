import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

/**
 * Stores cell values for the 12 predefined CC sub-spreadsheet columns:
 * col-cc-batch | col-cc-quantity-stock | col-cc-expiry-date |
 * col-cc-purchase-rate | col-cc-retail-profit | col-cc-retail-selling-rate |
 * col-cc-wholesale-profit | col-cc-wholesale-selling-rate |
 * col-cc-discount | col-cc-mrp | col-cc-status | col-cc-quantity-notified
 */
const InvCcCell = sequelize.define("InvCcCell", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    ccRowId: { type: DataTypes.UUID, allowNull: false },
    // columnId is one of the 12 predefined CC column constant IDs
    columnId: { type: DataTypes.STRING(50), allowNull: false },
    rawValue: { type: DataTypes.TEXT, allowNull: true, defaultValue: "" },
    computedValue: { type: DataTypes.TEXT, allowNull: true, defaultValue: "" }
}, {
    tableName: "inv_cc_cells",
    indexes: [
        { unique: true, fields: ["ccRowId", "columnId"] }
    ]
});

export default InvCcCell;
