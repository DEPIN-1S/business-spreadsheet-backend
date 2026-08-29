import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

/**
 * Each CC row = one batch entry inside the Sub-Spreadsheet View.
 * parentRowId → links to the product row (inv_rows) this batch belongs to.
 */
const InvCcRow = sequelize.define("InvCcRow", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    parentRowId: { type: DataTypes.UUID, allowNull: false },
    orderIndex: { type: DataTypes.INTEGER, defaultValue: 0 },
    styles: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: null,
        get() {
            const raw = this.getDataValue("styles");
            if (!raw) return null;
            if (typeof raw === "object") return raw;
            try { return JSON.parse(raw); } catch { return null; }
        },
        set(val) {
            this.setDataValue("styles", typeof val === "string" ? JSON.parse(val) : val);
        }
    },
    isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { tableName: "inv_cc_rows" });

export default InvCcRow;
