const fs = require('fs');
const file = './src/config/associations.js';
let content = fs.readFileSync(file, 'utf8');

const target1 = `import BusinessParty from "../features/business/business_party.model.js";`;
const repl1 = `import BusinessParty from "../features/business/business_party.model.js";\nimport SavedInvoice from "../features/business/saved_invoice.model.js";`;

const target2 = `    BusinessUser\n};`;
const repl2 = `    BusinessUser,\n    SavedInvoice\n};`;

const target3 = `Template.belongsTo(Business, { foreignKey: "businessId" });`;
const repl3 = `Template.belongsTo(Business, { foreignKey: "businessId" });\n\n// Business <-> SavedInvoice\nBusiness.hasMany(SavedInvoice, { foreignKey: "businessId", as: "savedInvoices" });\nSavedInvoice.belongsTo(Business, { foreignKey: "businessId" });`;

if (content.includes(target1) && content.includes(target3)) {
    content = content.replace(target1, repl1);
    content = content.replace(target2, repl2);
    content = content.replace(target3, repl3);
    fs.writeFileSync(file, content);
    console.log("Success");
} else {
    console.log("Targets not found.");
    if (!content.includes(target1)) console.log("Target 1 not found");
    if (!content.includes(target3)) console.log("Target 3 not found");
}
