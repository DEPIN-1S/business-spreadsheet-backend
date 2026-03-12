import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

/**
 * RefreshToken model
 * Stores long-lived refresh tokens for JWT token rotation.
 * One user can have multiple active tokens (multi-device support).
 */
const RefreshToken = sequelize.define("RefreshToken", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    token: { type: DataTypes.TEXT, allowNull: false, unique: true },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    isRevoked: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
    tableName: "refresh_tokens",
    indexes: [
        { fields: ["userId"] },
        { fields: ["token"] }
    ]
});

export default RefreshToken;
