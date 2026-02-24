import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const MediaFile = sequelize.define("MediaFile", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    cellId: { type: DataTypes.UUID, allowNull: true },
    uploadedBy: { type: DataTypes.UUID, allowNull: false },
    fileType: { type: DataTypes.ENUM("image", "audio", "document", "video", "other"), defaultValue: "other" },
    mimeType: { type: DataTypes.STRING, allowNull: true },
    fileUrl: { type: DataTypes.STRING, allowNull: false },
    originalName: { type: DataTypes.STRING, allowNull: false },
    sizeBytes: { type: DataTypes.BIGINT, defaultValue: 0 }
}, { tableName: "media_files" });

export default MediaFile;
