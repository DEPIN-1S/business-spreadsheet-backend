import express from "express";
import { protect } from "../../middleware/auth.js";
import {
    createBusiness, listBusinessParties, addBusinessParty, deleteBusinessParty,
    listBusinesses,
    getBusiness,
    updateBusiness,
    deleteBusiness
} from "./business.controller.js";

const router = express.Router();

router.use(protect()); // Apply auth to all business routes

router.route("/")
    .post(createBusiness)
    .get(listBusinesses);

router.route("/:id")
    .get(getBusiness)
    .put(updateBusiness)
    .delete(deleteBusiness);

router.get("/:id/parties", listBusinessParties);
router.post("/:id/parties", addBusinessParty);
router.delete("/:id/parties/:partyId", deleteBusinessParty);

export default router;

