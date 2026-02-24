import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const Admin = sequelize.define("Admin",{
  email:{ type: DataTypes.STRING, allowNull:false, unique:true },
  password:{ type: DataTypes.STRING, allowNull:false },
  role:{ type: DataTypes.STRING, defaultValue:"admin" }
},{ tableName:"admins" });

export default Admin;
