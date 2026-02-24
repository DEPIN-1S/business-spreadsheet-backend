import express from "express";
import { analytics, listUsers, createUser, updateUser, deleteUser, backup, restore } from "./superadmin.controller.js";
import { protect } from "../../middleware/auth.js";

const router = express.Router();
router.use(protect(["superadmin"]));

router.get("/analytics", analytics);
router.get("/users", listUsers);
router.post("/users", createUser);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);
router.get("/backup", backup);
router.post("/restore", restore);

export default router;
