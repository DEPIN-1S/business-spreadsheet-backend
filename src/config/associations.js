// Central associations file – import this once in server.js before sync
import User from "../features/user/user.model.js";
import RefreshToken from "../features/user/refresh_token.model.js";
import Spreadsheet from "../features/spreadsheet/spreadsheet.model.js";
import Column from "../features/spreadsheet/column.model.js";
import Row from "../features/spreadsheet/row.model.js";
import Cell from "../features/spreadsheet/cell.model.js";
import SheetPermission from "../features/spreadsheet/permission.model.js";
import ColumnPermission from "../features/spreadsheet/column_permission.model.js";
import Folder from "../features/spreadsheet/folder.model.js";
import FolderPermission from "../features/spreadsheet/folder_permission.model.js";
import Comment from "../features/spreadsheet/comment.model.js";
import MediaFile from "../features/media/media.model.js";
import ChatRoom from "../features/chat/chatroom.model.js";
import ChatMessage from "../features/chat/chatmessage.model.js";
import DirectMessage from "../features/chat/direct_message.model.js";
import AuditLog from "../features/audit/auditlog.model.js";
import InventoryItem from "../features/inventory/inventory.model.js";

// ── User ─────────────────────────────────────────────────────────────────────
User.hasMany(RefreshToken, { foreignKey: "userId", as: "refreshTokens", onDelete: "CASCADE" });
RefreshToken.belongsTo(User, { foreignKey: "userId" });

// ── Folder tree (self-referencing) ────────────────────────────────────────────
Folder.hasMany(Folder, { foreignKey: "parentId", as: "children" });
Folder.belongsTo(Folder, { foreignKey: "parentId", as: "parent" });
Folder.belongsTo(User, { foreignKey: "createdBy", as: "creator", constraints: false });

// Folder permissions
Folder.hasMany(FolderPermission, { foreignKey: "folderId", as: "permissions" });
FolderPermission.belongsTo(Folder, { foreignKey: "folderId" });
User.hasMany(FolderPermission, { foreignKey: "userId", as: "folderPermissions" });
FolderPermission.belongsTo(User, { foreignKey: "userId" });

// ── Spreadsheet / Folder association ─────────────────────────────────────────
Folder.hasMany(Spreadsheet, { foreignKey: "folderId", as: "sheets" });
Spreadsheet.belongsTo(Folder, { foreignKey: "folderId", as: "folder" });

// ── Spreadsheet associations ──────────────────────────────────────────────────
Spreadsheet.hasMany(Column, { foreignKey: "spreadsheetId", as: "columns" });
Column.belongsTo(Spreadsheet, { foreignKey: "spreadsheetId" });

Spreadsheet.hasMany(Row, { foreignKey: "spreadsheetId", as: "rows" });
Row.belongsTo(Spreadsheet, { foreignKey: "spreadsheetId" });

Row.hasMany(Cell, { foreignKey: "rowId", as: "cells" });
Cell.belongsTo(Row, { foreignKey: "rowId" });

Column.hasMany(Cell, { foreignKey: "columnId", as: "cells" });
Cell.belongsTo(Column, { foreignKey: "columnId" });

// ── Comments ──────────────────────────────────────────────────────────────────
Cell.hasMany(Comment, { foreignKey: "cellId", as: "comments" });
Comment.belongsTo(Cell, { foreignKey: "cellId" });
User.hasMany(Comment, { foreignKey: "userId", as: "comments" });
Comment.belongsTo(User, { foreignKey: "userId", as: "author" });

// ── Permissions ───────────────────────────────────────────────────────────────
User.hasMany(SheetPermission, { foreignKey: "userId", as: "permissions" });
SheetPermission.belongsTo(User, { foreignKey: "userId" });
Spreadsheet.hasMany(SheetPermission, { foreignKey: "spreadsheetId", as: "permissions" });
SheetPermission.belongsTo(Spreadsheet, { foreignKey: "spreadsheetId" });

// Virtual folder and Sharer identification
SheetPermission.belongsTo(Folder, { as: "virtualFolder", foreignKey: "virtualFolderId" });
SheetPermission.belongsTo(User, { as: "sharer", foreignKey: "invitedBy", constraints: false });

// Column-level privacy
User.hasMany(ColumnPermission, { foreignKey: "userId", as: "columnPermissions" });
ColumnPermission.belongsTo(User, { foreignKey: "userId" });
Spreadsheet.hasMany(ColumnPermission, { foreignKey: "spreadsheetId", as: "columnPermissions" });
ColumnPermission.belongsTo(Spreadsheet, { foreignKey: "spreadsheetId" });

// ── Media Files ───────────────────────────────────────────────────────────────
Cell.hasMany(MediaFile, { foreignKey: "cellId", as: "mediaFiles" });
MediaFile.belongsTo(Cell, { foreignKey: "cellId" });
User.hasMany(MediaFile, { foreignKey: "uploadedBy", as: "uploads" });

// ── Chat ──────────────────────────────────────────────────────────────────────
Spreadsheet.hasMany(ChatRoom, { foreignKey: "spreadsheetId", as: "chatRooms" });
ChatRoom.belongsTo(Spreadsheet, { foreignKey: "spreadsheetId" });
ChatRoom.hasMany(ChatMessage, { foreignKey: "roomId", as: "messages" });
ChatMessage.belongsTo(ChatRoom, { foreignKey: "roomId" });
User.hasMany(ChatMessage, { foreignKey: "userId", as: "chatMessages" });
ChatMessage.belongsTo(User, { foreignKey: "userId", as: "author" });

// ── Direct Messages (Personal Chat) ──────────────────────────────────────────
User.hasMany(DirectMessage, { foreignKey: "senderId", as: "sentMessages", constraints: false });
User.hasMany(DirectMessage, { foreignKey: "receiverId", as: "receivedMessages", constraints: false });
DirectMessage.belongsTo(User, { foreignKey: "senderId", as: "sender", constraints: false });
DirectMessage.belongsTo(User, { foreignKey: "receiverId", as: "receiver", constraints: false });

// ── Audit Log ─────────────────────────────────────────────────────────────────
User.hasMany(AuditLog, { foreignKey: "userId", as: "auditLogs" });
AuditLog.belongsTo(User, { foreignKey: "userId", as: "user" });

// ── Inventory ─────────────────────────────────────────────────────────────────
Spreadsheet.hasMany(InventoryItem, { foreignKey: "spreadsheetId", as: "inventoryItems" });
InventoryItem.belongsTo(Spreadsheet, { foreignKey: "spreadsheetId" });

// Creator associations (no FK enforcement to avoid circular issues)
Spreadsheet.belongsTo(User, { foreignKey: "createdBy", as: "creator", constraints: false });

export {
    User, RefreshToken,
    Folder, FolderPermission,
    Spreadsheet, Column, Row, Cell,
    SheetPermission, ColumnPermission,
    Comment,
    MediaFile,
    ChatRoom, ChatMessage, DirectMessage,
    AuditLog, InventoryItem
};
