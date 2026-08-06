import express from "express";
import { protect } from "../../middleware/auth.js";
import {
    listFolders, createFolder, updateFolder, deleteFolder,
    listSheets, createSheet, getSheet, updateSheet, deleteSheet,
    addRow, deleteRow, updateCells, copyRow,
    getCcMeta, updateCcMeta,
    listCcRows, addCcRow, deleteCcRow, updateCcCells, copyCcRow,
    listAllBatches
} from "./inv_sheet.controller.js";

const folderRouter = express.Router();
folderRouter.use(protect(["superadmin"]));
folderRouter.get("/", listFolders);
folderRouter.post("/", createFolder);
folderRouter.put("/:id", updateFolder);
folderRouter.delete("/:id", deleteFolder);

const sheetRouter = express.Router();
sheetRouter.use(protect(["superadmin"]));

// File (spreadsheet) routes
sheetRouter.get("/batches", listAllBatches);
sheetRouter.get("/", listSheets);
sheetRouter.post("/", createSheet);
sheetRouter.get("/:id", getSheet);
sheetRouter.put("/:id", updateSheet);
sheetRouter.delete("/:id", deleteSheet);

// Main rows & cells
sheetRouter.post("/:id/rows", addRow);
sheetRouter.post("/:id/rows/:rowId/copy", copyRow);
sheetRouter.delete("/:id/rows/:rowId", deleteRow);
sheetRouter.put("/:id/rows/:rowId/cells", updateCells);

// CC Meta (6 dropdowns per product row)
sheetRouter.get("/:id/rows/:rowId/cc-meta", getCcMeta);
sheetRouter.put("/:id/rows/:rowId/cc-meta", updateCcMeta);

// CC rows & cells (batch Sub-Spreadsheet View)
sheetRouter.get("/:id/rows/:rowId/cc-rows", listCcRows);
sheetRouter.post("/:id/rows/:rowId/cc-rows", addCcRow);
sheetRouter.post("/:id/rows/:rowId/cc-rows/:ccRowId/copy", copyCcRow);
sheetRouter.delete("/:id/rows/:rowId/cc-rows/:ccRowId", deleteCcRow);
sheetRouter.put("/:id/rows/:rowId/cc-rows/:ccRowId/cells", updateCcCells);

export { folderRouter, sheetRouter };
