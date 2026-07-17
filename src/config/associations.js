// Central associations file – import this once in server.js before sync

// ── EXISTING imports (untouched) ───────────────────────────────────────────────
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

// ── NEW: Inventory Sheet imports (separate tables) ─────────────────────────────
import InvFolder from "../features/inv_sheet/inv_folder.model.js";
import InvSpreadsheet from "../features/inv_sheet/inv_spreadsheet.model.js";
import InvRow from "../features/inv_sheet/inv_row.model.js";
import InvCell from "../features/inv_sheet/inv_cell.model.js";
import InvCcRow from "../features/inv_sheet/inv_cc_row.model.js";
import InvCcCell from "../features/inv_sheet/inv_cc_cell.model.js";
import InvCcMeta from "../features/inv_sheet/inv_cc_meta.model.js";

// ── NEW: Inventory Masters imports ─────────────────────────────────────────────
import InvGstOption from "../features/inv_masters/inv_gst.model.js";
import InvCategory from "../features/inv_masters/inv_category.model.js";
import InvDivision from "../features/inv_masters/inv_division.model.js";
import InvManufacturer from "../features/inv_masters/inv_manufacturer.model.js";
import InvCompany from "../features/inv_masters/inv_company.model.js";
import InvQuantityUnit from "../features/inv_masters/inv_quantity.model.js";

// ── NEW: Inventory Billing imports ─────────────────────────────────────────────
import RetailParty from "../features/inv_billing/retail_party.model.js";
import WholesaleParty from "../features/inv_billing/wholesale_party.model.js";
import Invoice from "../features/inv_billing/invoice.model.js";
import InvoiceItem from "../features/inv_billing/invoice_item.model.js";
import LedgerEntry from "../features/inv_billing/ledger.model.js";
import InvNotification from "../features/inv_notifications/inv_notification.model.js";

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

// ── Inventory (old simple model — kept as-is) ─────────────────────────────────
Spreadsheet.hasMany(InventoryItem, { foreignKey: "spreadsheetId", as: "inventoryItems" });
InventoryItem.belongsTo(Spreadsheet, { foreignKey: "spreadsheetId" });

// Creator associations (no FK enforcement to avoid circular issues)
Spreadsheet.belongsTo(User, { foreignKey: "createdBy", as: "creator", constraints: false });

// ── NEW: Inventory Sheet Associations ─────────────────────────────────────────
// InvFolder self-referencing (parent-child folders)
InvFolder.hasMany(InvFolder, { foreignKey: "parentId", as: "children" });
InvFolder.belongsTo(InvFolder, { foreignKey: "parentId", as: "parent" });

// InvSpreadsheet belongs to InvFolder
InvFolder.hasMany(InvSpreadsheet, { foreignKey: "folderId", as: "sheets" });
InvSpreadsheet.belongsTo(InvFolder, { foreignKey: "folderId", as: "folder" });

// InvRow belongs to InvSpreadsheet
InvSpreadsheet.hasMany(InvRow, { foreignKey: "spreadsheetId", as: "rows" });
InvRow.belongsTo(InvSpreadsheet, { foreignKey: "spreadsheetId" });

// InvCell belongs to InvRow
InvRow.hasMany(InvCell, { foreignKey: "rowId", as: "cells" });
InvCell.belongsTo(InvRow, { foreignKey: "rowId" });

// InvCcMeta belongs to InvRow (one-to-one)
InvRow.hasOne(InvCcMeta, { foreignKey: "rowId", as: "ccMeta" });
InvCcMeta.belongsTo(InvRow, { foreignKey: "rowId" });

// InvCcRow belongs to InvRow (parent product row)
InvRow.hasMany(InvCcRow, { foreignKey: "parentRowId", as: "ccRows" });
InvCcRow.belongsTo(InvRow, { foreignKey: "parentRowId" });

// InvCcCell belongs to InvCcRow
InvCcRow.hasMany(InvCcCell, { foreignKey: "ccRowId", as: "cells" });
InvCcCell.belongsTo(InvCcRow, { foreignKey: "ccRowId" });

// ── NEW: Billing Associations ─────────────────────────────────────────────────
// Invoice → InvoiceItems
Invoice.hasMany(InvoiceItem, { foreignKey: "invoiceId", as: "items" });
InvoiceItem.belongsTo(Invoice, { foreignKey: "invoiceId" });

// InvoiceItem → InvCcRow (batch linkage)
InvoiceItem.belongsTo(InvCcRow, { foreignKey: "invCcRowId", as: "ccRow" });
InvCcRow.hasMany(InvoiceItem, { foreignKey: "invCcRowId", as: "invoiceItems" });

// Invoice → LedgerEntry
Invoice.hasOne(LedgerEntry, { foreignKey: "invoiceId", as: "ledgerEntry" });
LedgerEntry.belongsTo(Invoice, { foreignKey: "invoiceId" });

export {
    // Existing
    User, RefreshToken,
    Folder, FolderPermission,
    Spreadsheet, Column, Row, Cell,
    SheetPermission, ColumnPermission,
    Comment,
    MediaFile,
    ChatRoom, ChatMessage, DirectMessage,
    AuditLog, InventoryItem,
    // Inventory Sheet (new)
    InvFolder, InvSpreadsheet, InvRow, InvCell,
    InvCcRow, InvCcCell, InvCcMeta,
    // Inventory Masters (new)
    InvGstOption, InvCategory, InvDivision,
    InvManufacturer, InvCompany, InvQuantityUnit,
    // Inventory Billing (new)
    RetailParty, WholesaleParty, Invoice, InvoiceItem, LedgerEntry, InvNotification
};
