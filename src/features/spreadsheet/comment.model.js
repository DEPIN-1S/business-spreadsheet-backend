import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

/**
 * Comment model — cell-level comments with full audit fields.
 */
const Comment = sequelize.define("Comment", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    cellId: { type: DataTypes.UUID, allowNull: false },
    sheetId: { type: DataTypes.UUID, allowNull: false },  // for easy permission check
    userId: { type: DataTypes.UUID, allowNull: false },
    text: { type: DataTypes.TEXT, allowNull: false },
    isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
    tableName: "comments",
    indexes: [{ fields: ["cellId"] }, { fields: ["sheetId"] }, { fields: ["userId"] }]
});

export default Comment;
