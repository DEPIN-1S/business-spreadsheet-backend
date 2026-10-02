const fs = require('fs');
const file = './src/features/business/business.routes.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    /deleteBusiness\s*\}\s*from\s*"\.\/business\.controller\.js";/,
    'deleteBusiness,\n    saveInvoice, getSavedInvoices, deleteSavedInvoice, clearSavedInvoices\n} from "./business.controller.js";'
);

fs.writeFileSync(file, content);
console.log("Success");
