import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const AuditLog = sequelize.define("AuditLog", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: true },
    entity: { type: DataTypes.STRING, allowNull: false },        // cell | row | column | sheet | permission | inventory
    entityId: { type: DataTypes.STRING, allowNull: true },
    action: { type: DataTypes.ENUM("create", "update", "delete", "login", "export"), allowNull: false },
    oldValue: { type: DataTypes.JSON, allowNull: true },
    newValue: { type: DataTypes.JSON, allowNull: true },
    ip: { type: DataTypes.STRING, allowNull: true },
    meta: { type: DataTypes.JSON, allowNull: true }
}, {
    tableName: "audit_logs",
    updatedAt: false
});

export default AuditLog;
