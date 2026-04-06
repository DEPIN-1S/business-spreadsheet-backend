/**
 * SuperAdmin Seeder Script
 * ─────────────────────────────────────────────────────────────────────────
 * Run ONCE to create the first SuperAdmin account.
 *
 * Usage:
 *   node src/seeders/createSuperAdmin.js
 *
 * You can also override defaults with env vars:
 *   SA_NAME="Boss" SA_EMAIL="boss@company.com" SA_PASSWORD="Str0ng@Pass" \
 *   node src/seeders/createSuperAdmin.js
 */

import "dotenv/config";
import { Sequelize } from "sequelize";
import sequelize from "../config/db.js";
import "../config/associations.js";   // load all models & associations
import User from "../features/user/user.model.js";

const NAME = process.env.SA_NAME || "Super Admin";
const PHONE = process.env.SA_PHONE || "9999999999";
const EMAIL = process.env.SA_EMAIL || "superadmin@datarithm.com";

async function main() {
    try {
        // 1. Connect to database
        await sequelize.authenticate();
        console.log("✅  Database connected");

        // 2. Sync models (non-destructive)
        await sequelize.sync({ alter: false });
        console.log("✅  Models synced");

        // 3. Check if this phone already exists
        const existing = await User.findOne({ where: { phone: PHONE } });
        if (existing) {
            console.log(`⚠️   SuperAdmin already exists: ${existing.phone} (role: ${existing.role})`);
            if (existing.role !== "superadmin") {
                await existing.update({ role: "superadmin", isActive: true });
                console.log("✅  Role upgraded to superadmin");
            }
            process.exit(0);
        }

        // 4. Create superadmin
        const user = await User.create({
            name: NAME,
            phone: PHONE,
            email: EMAIL,
            role: "superadmin",
            isActive: true
        });

        console.log("\n🎉  SuperAdmin created successfully!");
        console.log("─────────────────────────────────────");
        console.log(`   Name     : ${user.name}`);
        console.log(`   Phone    : ${user.phone}`);
        console.log(`   Email    : ${user.email}`);
        console.log(`   Role     : ${user.role}`);
        console.log(`   ID       : ${user.id}`);
        console.log("─────────────────────────────────────");
        console.log("⚠️   Use this phone number to login via OTP!\n");

        process.exit(0);
    } catch (err) {
        console.error("❌  Seeder failed:", err.message);
        process.exit(1);
    }
}

main();
