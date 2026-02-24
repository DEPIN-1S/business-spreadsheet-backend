import express from "express";
import { register, login, me, getAll, updateUser, deleteUser } from "./user.controller.js";
import { protect } from "../../middleware/auth.js";
import { validate, schemas } from "../../middleware/validate.js";

const router = express.Router();

router.post("/register", validate(schemas.register), register);
router.post("/login", validate(schemas.login), login);
router.get("/me", protect(), me);
router.get("/", protect(["admin", "superadmin"]), getAll);
router.put("/:id", protect(["admin", "superadmin"]), updateUser);
router.delete("/:id", protect(["admin", "superadmin"]), deleteUser);

export default router;
