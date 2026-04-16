import Spreadsheet from "./features/spreadsheet/spreadsheet.model.js";
import Cell from "./features/spreadsheet/cell.model.js";
import Row from "./features/spreadsheet/row.model.js";
import { Op } from "sequelize";

export const runCCMigration = async () => {
    try {
        console.log("🔄 Starting C.C sub-sheet migration...");
        
        // Find All sheet IDs linked in cells
        const cellSheets = await Cell.findAll({
            attributes: ["nestedSheetId"],
            where: { nestedSheetId: { [Op.ne]: null } },
            raw: true
        });
        
        // Find All sheet IDs linked in rows
        const rowSheets = await Row.findAll({
            attributes: ["nestedSheetId"],
            where: { nestedSheetId: { [Op.ne]: null } },
            raw: true
        });
        
        const subSheetIds = [...new Set([
            ...cellSheets.map(c => c.nestedSheetId),
            ...rowSheets.map(r => r.nestedSheetId)
        ])];
        
        if (subSheetIds.length > 0) {
            const [count] = await Spreadsheet.update(
                { isDetailedView: true },
                { where: { id: { [Op.in]: subSheetIds } } }
            );
            console.log(`✅ Migration successful! Marked ${count} existing detailed views.`);
        } else {
            console.log("ℹ️ No existing sub-sheets found to migrate.");
        }
    } catch (error) {
        console.error("❌ Migration failed:", error);
    }
};
