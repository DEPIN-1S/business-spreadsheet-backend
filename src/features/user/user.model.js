import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const User = sequelize.define("User", {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: true },
  phone: { type: DataTypes.STRING, allowNull: false, unique: true },
  avatar: { type: DataTypes.STRING, allowNull: true },
  loginOtp: { type: DataTypes.STRING, allowNull: true },
  loginOtpExpiry: { type: DataTypes.DATE, allowNull: true },
  role: { type: DataTypes.ENUM("staff", "admin", "superadmin"), defaultValue: "staff" },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  createdBy: { type: DataTypes.UUID, allowNull: true }
}, { tableName: "users", paranoid: false });

export default User;
