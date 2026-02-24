import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const Superadmin = sequelize.define("Superadmin",{
  email:{ type: DataTypes.STRING, allowNull:false, unique:true },
  password:{ type: DataTypes.STRING, allowNull:false },
  role:{ type: DataTypes.STRING, defaultValue:"superadmin" }
},{ tableName:"superadmins" });

export default Superadmin;
