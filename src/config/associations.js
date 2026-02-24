// Central associations file – import this once in server.js before sync
import User from "../features/user/user.model.js";
import Spreadsheet from "../features/spreadsheet/spreadsheet.model.js";
import Column from "../features/spreadsheet/column.model.js";
import Row from "../features/spreadsheet/row.model.js";
import Cell from "../features/spreadsheet/cell.model.js";
import SheetPermission from "../features/spreadsheet/permission.model.js";
import MediaFile from "../features/media/media.model.js";
import ChatRoom from "../features/chat/chatroom.model.js";
import ChatMessage from "../features/chat/chatmessage.model.js";
import AuditLog from "../features/audit/auditlog.model.js";
import InventoryItem from "../features/inventory/inventory.model.js";

// Spreadsheet associations
Spreadsheet.hasMany(Column, { foreignKey: "spreadsheetId", as: "columns" });
Column.belongsTo(Spreadsheet, { foreignKey: "spreadsheetId" });

Spreadsheet.hasMany(Row, { foreignKey: "spreadsheetId", as: "rows" });
Row.belongsTo(Spreadsheet, { foreignKey: "spreadsheetId" });

Row.hasMany(Cell, { foreignKey: "rowId", as: "cells" });
Cell.belongsTo(Row, { foreignKey: "rowId" });

Column.hasMany(Cell, { foreignKey: "columnId", as: "cells" });
Cell.belongsTo(Column, { foreignKey: "columnId" });

// Permissions
User.hasMany(SheetPermission, { foreignKey: "userId", as: "permissions" });
SheetPermission.belongsTo(User, { foreignKey: "userId" });
Spreadsheet.hasMany(SheetPermission, { foreignKey: "spreadsheetId", as: "permissions" });
SheetPermission.belongsTo(Spreadsheet, { foreignKey: "spreadsheetId" });

// Media Files
Cell.hasMany(MediaFile, { foreignKey: "cellId", as: "mediaFiles" });
MediaFile.belongsTo(Cell, { foreignKey: "cellId" });
User.hasMany(MediaFile, { foreignKey: "uploadedBy", as: "uploads" });

// Chat
Spreadsheet.hasMany(ChatRoom, { foreignKey: "spreadsheetId", as: "chatRooms" });
ChatRoom.belongsTo(Spreadsheet, { foreignKey: "spreadsheetId" });
ChatRoom.hasMany(ChatMessage, { foreignKey: "roomId", as: "messages" });
ChatMessage.belongsTo(ChatRoom, { foreignKey: "roomId" });
User.hasMany(ChatMessage, { foreignKey: "userId", as: "chatMessages" });
ChatMessage.belongsTo(User, { foreignKey: "userId", as: "author" });

// Audit Log
User.hasMany(AuditLog, { foreignKey: "userId", as: "auditLogs" });
AuditLog.belongsTo(User, { foreignKey: "userId", as: "user" });

// Inventory
Spreadsheet.hasMany(InventoryItem, { foreignKey: "spreadsheetId", as: "inventoryItems" });
InventoryItem.belongsTo(Spreadsheet, { foreignKey: "spreadsheetId" });

// Creator associations (no FK enforcement to avoid circular issues)
Spreadsheet.belongsTo(User, { foreignKey: "createdBy", as: "creator", constraints: false });

export {
    User, Spreadsheet, Column, Row, Cell,
    SheetPermission, MediaFile,
    ChatRoom, ChatMessage,
    AuditLog, InventoryItem
};
