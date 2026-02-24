import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const ChatMessage = sequelize.define("ChatMessage", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    roomId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: true },
    fileUrl: { type: DataTypes.STRING, allowNull: true },
    fileType: { type: DataTypes.STRING, allowNull: true }
}, {
    tableName: "chat_messages",
    updatedAt: false
});

export default ChatMessage;
