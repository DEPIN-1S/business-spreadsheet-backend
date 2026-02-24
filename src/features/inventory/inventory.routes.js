import express from "express";
import { createItem, listItems, getItem, updateItem, deleteItem, lowStockAlerts, summary } from "./inventory.controller.js";
import { protect } from "../../middleware/auth.js";
import { validate, schemas } from "../../middleware/validate.js";

const router = express.Router();
router.use(protect());

router.get("/alerts/low-stock", protect(["admin", "superadmin"]), lowStockAlerts);
router.get("/summary", protect(["admin", "superadmin"]), summary);
router.post("/", protect(["admin", "superadmin"]), validate(schemas.inventoryItem), createItem);
router.get("/", listItems);
router.get("/:id", getItem);
router.put("/:id", protect(["admin", "superadmin"]), validate(schemas.inventoryItem), updateItem);
router.delete("/:id", protect(["admin", "superadmin"]), deleteItem);

export default router;
