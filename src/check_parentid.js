import sequelize from "./config/db.js";
import InvFolder from "./features/inv_sheet/inv_folder.model.js";

const folders = await InvFolder.findAll({ where: { isDeleted: false } });
const json = folders.map(f => f.toJSON());
console.log("Raw JSON output:");
console.log(JSON.stringify(json, null, 2));
console.log("\nparentId value:", json[0]?.parentId);
console.log("parentId type:", typeof json[0]?.parentId);
console.log("parentId === null:", json[0]?.parentId === null);
console.log("parentId == null:", json[0]?.parentId == null);

await sequelize.close();
