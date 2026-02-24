import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const ChatRoom = sequelize.define("ChatRoom", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    spreadsheetId: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false }
}, { tableName: "chat_rooms" });

export default ChatRoom;
