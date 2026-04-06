import express from "express";
import {
    register, sendLoginOtp, verifyLoginOtp, me, getAll, searchUsers, updateUser, deleteUser,
    refreshToken, logout
} from "./user.controller.js";
import { protect } from "../../middleware/auth.js";

const router = express.Router();

// Public
router.post("/register", register);
router.post("/send-otp", sendLoginOtp);
router.post("/verify-otp", verifyLoginOtp);
router.post("/refresh", refreshToken);
router.post("/logout", protect(), logout);

// Protected
router.get("/me", protect(), me);
router.get("/search", protect(), searchUsers);
router.get("/", protect(["admin", "superadmin"]), getAll);
router.put("/:id", protect(["admin", "superadmin"]), updateUser);
router.delete("/:id", protect(["admin", "superadmin"]), deleteUser);

export default router;
