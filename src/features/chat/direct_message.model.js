import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

/**
 * DirectMessage — personal 1-on-1 chat between two users.
 * senderId / receiverId uniquely identify the conversation participants.
 */
const DirectMessage = sequelize.define("DirectMessage", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    senderId: { type: DataTypes.UUID, allowNull: false },
    receiverId: { type: DataTypes.UUID, allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: true },
    fileUrl: { type: DataTypes.STRING, allowNull: true },
    fileType: {
        type: DataTypes.ENUM("text", "image", "audio", "video", "file"),
        defaultValue: "text"
    },
    duration: { type: DataTypes.INTEGER, allowNull: true },   // audio duration in seconds
    isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
    isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
    tableName: "direct_messages",
    indexes: [
        { fields: ["senderId"] },
        { fields: ["receiverId"] },
        { fields: ["senderId", "receiverId"] }
    ]
});

export default DirectMessage;
