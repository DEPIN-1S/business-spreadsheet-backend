
const fs = require('fs');
const controllerFile = 'src/features/business/business.controller.js';
let cContent = fs.readFileSync(controllerFile, 'utf8');

const regex = /export const listBusinessParties = async \([^)]+\) => \{[\s\S]*?\n\s*\};/m;

const replacement = 'export const listBusinessParties = async (req, res) => {\\n' +
'    try {\\n' +
'        const page = parseInt(req.query.page) || 1;\\n' +
'        const limit = parseInt(req.query.limit) || 10;\\n' +
'        const offset = (page - 1) * limit;\\n' +
'\\n' +
'        const { count, rows: parties } = await BusinessParty.findAndCountAll({\\n' +
'            where: { businessId: req.params.id, isDeleted: false },\\n' +
'            order: [[\x27createdAt\x27, \x27DESC\x27]],\\n' +
'            limit: limit,\\n' +
'            offset: offset\\n' +
'        });\\n' +
'        \\n' +
'        res.status(200).json({ \\n' +
'            success: true, \\n' +
'            parties, \\n' +
'            pagination: {\\n' +
'                totalItems: count,\\n' +
'                totalPages: Math.ceil(count / limit),\\n' +
'                currentPage: page,\\n' +
'                limit\\n' +
'            }\\n' +
'        });\\n' +
'    } catch (error) {\\n' +
'        console.error(\x27Error fetching parties:\x27, error);\\n' +
'        res.status(500).json({ success: false, message: \x27Server error\x27 });\\n' +
'    }\\n' +
'};';

cContent = cContent.replace(regex, replacement);
fs.writeFileSync(controllerFile, cContent);
console.log('Patched listBusinessParties with pagination');
