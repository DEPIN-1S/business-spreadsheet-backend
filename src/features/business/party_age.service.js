import BusinessParty from "./business_party.model.js";
import RetailParty from "../inv_billing/retail_party.model.js";
import WholesaleParty from "../inv_billing/wholesale_party.model.js";
import { Op } from "sequelize";

/**
 * Increments age according to business rules:
 * - If age is a decimal < 1 (e.g. .7 or 0.2, representing months old):
 *   On January 1 it changes to 1 (plus any additional elapsed years).
 * - If age is >= 1 (e.g. 22):
 *   On January 1 it increments by +1 (e.g. 22 -> 23).
 */
export const incrementAgeValue = (currentAge, yearsDiff = 1) => {
    if (!currentAge || yearsDiff <= 0) return currentAge;
    const str = String(currentAge).trim();
    if (!str) return currentAge;

    const num = parseFloat(str);
    if (isNaN(num)) return currentAge;

    if (num < 1) {
        // Less than 1 year (e.g. .7 or 0.2)
        const newAge = 1 + (yearsDiff - 1);
        return String(newAge);
    } else {
        // 1 year or older (e.g. 22)
        const newAge = Math.floor(num) + yearsDiff;
        return String(newAge);
    }
};

/**
 * Checks and updates ages for all parties across Business, Retail, and Wholesale models
 * if the year has changed since ageLastUpdatedYear.
 */
export const updatePartiesAgeForNewYear = async () => {
    try {
        const currentYear = new Date().getFullYear();
        let updatedCount = 0;

        const partyModels = [
            { name: "BusinessParty", model: BusinessParty },
            { name: "RetailParty", model: RetailParty },
            { name: "WholesaleParty", model: WholesaleParty }
        ];

        for (const { name, model } of partyModels) {
            const parties = await model.findAll({
                where: {
                    isDeleted: false,
                    age: {
                        [Op.ne]: null
                    }
                }
            });

            for (const party of parties) {
                if (!party.age || String(party.age).trim() === "") continue;

                // Determine the year this age was recorded / last updated
                const baseYear = party.ageLastUpdatedYear 
                    || (party.createdAt ? new Date(party.createdAt).getFullYear() : currentYear);

                if (currentYear > baseYear) {
                    const yearsDiff = currentYear - baseYear;
                    const oldAge = party.age;
                    const newAge = incrementAgeValue(oldAge, yearsDiff);

                    if (newAge !== oldAge) {
                        party.age = newAge;
                        party.ageLastUpdatedYear = currentYear;
                        await party.save();
                        updatedCount++;
                    } else if (!party.ageLastUpdatedYear) {
                        party.ageLastUpdatedYear = currentYear;
                        await party.save();
                    }
                } else if (!party.ageLastUpdatedYear) {
                    // Set currentYear if missing
                    party.ageLastUpdatedYear = currentYear;
                    await party.save();
                }
            }
        }

        if (updatedCount > 0) {
            console.log(`[Party Age Sync] Successfully incremented age for ${updatedCount} parties on January 1 sync (Year: ${currentYear}).`);
        }
    } catch (error) {
        console.error("[Party Age Sync] Error updating parties age:", error);
    }
};
