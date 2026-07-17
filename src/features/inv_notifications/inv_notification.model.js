import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const InvNotification = sequelize.define("InvNotification", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    type: {
        type: DataTypes.ENUM("expiry_alert", "low_stock", "out_of_stock"),
        allowNull: false
    },
    title: { type: DataTypes.STRING(200), allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: true },
    invCcRowId: { type: DataTypes.UUID, allowNull: true },
    invRowId: { type: DataTypes.UUID, allowNull: true },
    productName: { type: DataTypes.STRING(200), allowNull: true },
    batchName: { type: DataTypes.STRING(100), allowNull: true },
    currentQty: { type: DataTypes.INTEGER, allowNull: true },
    expiryDate: { type: DataTypes.DATEONLY, allowNull: true },
    isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
    isDismissed: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { tableName: "inv_notifications" });

export default InvNotification;
