
const fs = require('fs');

const controllerFile = 'src/features/business/business.controller.js';
let cContent = fs.readFileSync(controllerFile, 'utf8');

const deleteFunc = '\n' +
'export const deleteBusinessParty = async (req, res) => {\n' +
'    try {\n' +
'        const { id, partyId } = req.params;\n' +
'        const { default: BusinessParty } = await import(\x22./business_party.model.js\x22);\n' +
'        const party = await BusinessParty.findOne({ where: { id: partyId, businessId: id } });\n' +
'        if (!party) return res.status(404).json({ success: false, message: \x22Party not found\x22 });\n' +
'        \n' +
'        party.isDeleted = true;\n' +
'        await party.save();\n' +
'        \n' +
'        res.status(200).json({ success: true, message: \x22Party deleted successfully\x22 });\n' +
'    } catch (error) {\n' +
'        console.error(\x22Error deleting party:\x22, error);\n' +
'        res.status(500).json({ success: false, message: \x22Server error\x22 });\n' +
'    }\n' +
'};\n';

if (!cContent.includes('deleteBusinessParty')) {
    fs.writeFileSync(controllerFile, cContent + deleteFunc);
    console.log('Added deleteBusinessParty to controller');
}

const routesFile = 'src/features/business/business.routes.js';
let rContent = fs.readFileSync(routesFile, 'utf8');
if (!rContent.includes('deleteBusinessParty')) {
    rContent = rContent.replace(/addBusinessParty,/g, 'addBusinessParty, deleteBusinessParty,');
    rContent = rContent.replace(/router\.post\(\x22\/:id\/parties\x22, addBusinessParty\);/g, 'router.post(\x22/:id/parties\x22, addBusinessParty);\nrouter.delete(\x22/:id/parties/:partyId\x22, deleteBusinessParty);');
    fs.writeFileSync(routesFile, rContent);
    console.log('Added deleteBusinessParty route');
}
