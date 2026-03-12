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
import bcrypt from "bcryptjs";
import { Sequelize } from "sequelize";
import sequelize from "../config/db.js";
import "../config/associations.js";   // load all models & associations
import User from "../features/user/user.model.js";

const NAME = process.env.SA_NAME || "Super Admin";
const EMAIL = process.env.SA_EMAIL || "superadmin@datarithm.com";
const PASSWORD = process.env.SA_PASSWORD || "SuperAdmin@123";

async function main() {
    try {
        // 1. Connect to database
        await sequelize.authenticate();
        console.log("✅  Database connected");

        // 2. Sync models (non-destructive)
        await sequelize.sync({ alter: false });
        console.log("✅  Models synced");

        // 3. Check if this email already exists
        const existing = await User.findOne({ where: { email: EMAIL } });
        if (existing) {
            console.log(`⚠️   SuperAdmin already exists: ${existing.email} (role: ${existing.role})`);
            if (existing.role !== "superadmin") {
                await existing.update({ role: "superadmin", isActive: true });
                console.log("✅  Role upgraded to superadmin");
            }
            process.exit(0);
        }

        // 4. Create superadmin
        const hash = await bcrypt.hash(PASSWORD, 12);
        const user = await User.create({
            name: NAME,
            email: EMAIL,
            password: hash,
            role: "superadmin",
            isActive: true
        });

        console.log("\n🎉  SuperAdmin created successfully!");
        console.log("─────────────────────────────────────");
        console.log(`   Name     : ${user.name}`);
        console.log(`   Email    : ${user.email}`);
        console.log(`   Password : ${PASSWORD}`);
        console.log(`   Role     : ${user.role}`);
        console.log(`   ID       : ${user.id}`);
        console.log("─────────────────────────────────────");
        console.log("⚠️   Change this password immediately after first login!\n");

        process.exit(0);
    } catch (err) {
        console.error("❌  Seeder failed:", err.message);
        process.exit(1);
    }
}

main();
