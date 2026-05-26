/**
 * Automated Test: My Files Isolation
 * 
 * This test verifies that when a staff user creates a folder/file,
 * it does NOT appear in the superadmin's "My Files" view.
 * 
 * Steps:
 *   1. Login as superadmin (phone: 9999999999)
 *   2. Get superadmin's current folders & sheets (My Files)
 *   3. Login as a staff user (find one or create one)
 *   4. Staff creates a folder and a sheet
 *   5. Re-fetch superadmin's folders & sheets
 *   6. Verify the staff-created items do NOT appear for superadmin
 *   7. Cleanup: delete the test folder & sheet
 */

const BASE = "http://localhost:6041/api";

async function apiCall(method, path, body = null, token = null) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    
    const res = await fetch(`${BASE}${path}`, opts);
    const data = await res.json();
    return { status: res.status, data };
}

async function login(phone) {
    // Send OTP
    await apiCall("POST", "/user/send-otp", { phone });
    // Verify with dev OTP
    const res = await apiCall("POST", "/user/verify-otp", { phone, otp: "1234" });
    if (!res.data?.data?.accessToken) {
        throw new Error(`Login failed for ${phone}: ${JSON.stringify(res.data)}`);
    }
    return { token: res.data.data.accessToken, user: res.data.data.user };
}

async function findStaffUser(superToken) {
    // Try to find a staff user from superadmin's user list
    const res = await apiCall("GET", "/superadmin/users", null, superToken);
    const users = res.data?.data || [];
    const staffUser = users.find(u => u.role === "staff" && u.phone && u.phone !== "9999999999");
    return staffUser;
}

async function main() {
    console.log("═══════════════════════════════════════════════════");
    console.log("  TEST: My Files Isolation (Staff → Superadmin)");
    console.log("═══════════════════════════════════════════════════\n");

    let passed = 0;
    let failed = 0;
    let testFolderId = null;
    let testSheetId = null;
    let staffToken = null;
    let superToken = null;

    try {
        // ── Step 1: Login as superadmin ──────────────────────────────
        console.log("1️⃣  Logging in as superadmin (8606475372)...");
        const superLogin = await login("8606475372");
        superToken = superLogin.token;
        const superUserId = superLogin.user.id;
        console.log(`   ✅ Logged in as: ${superLogin.user.name} (${superLogin.user.role})\n`);

        // ── Step 2: Find a staff user ───────────────────────────────
        console.log("2️⃣  Finding a staff user...");
        const staffUser = await findStaffUser(superToken);
        if (!staffUser) {
            console.log("   ⚠️  No staff user found. Creating a test staff user...");
            // Create a test staff user
            const createRes = await apiCall("POST", "/superadmin/users", {
                name: "Test Staff User",
                phone: "1111111111",
                role: "staff"
            }, superToken);
            if (createRes.status !== 201 && createRes.status !== 200) {
                // Try to login with the phone in case user exists
                console.log("   Trying to login with existing test user...");
            }
            const staffLogin = await login("1111111111");
            staffToken = staffLogin.token;
            console.log(`   ✅ Logged in as staff: ${staffLogin.user.name} (${staffLogin.user.role})\n`);
        } else {
            console.log(`   Found staff: ${staffUser.name} (${staffUser.phone})`);
            const staffLogin = await login(staffUser.phone);
            staffToken = staffLogin.token;
            console.log(`   ✅ Logged in as staff: ${staffLogin.user.name} (${staffLogin.user.role})\n`);
        }

        // ── Step 3: Get superadmin's current My Files ───────────────
        console.log("3️⃣  Fetching superadmin's My Files BEFORE staff creates items...");
        const superFoldersBefore = await apiCall("GET", "/folders", null, superToken);
        const superSheetsBefore = await apiCall("GET", "/sheets?limit=1000", null, superToken);
        const folderCountBefore = (superFoldersBefore.data?.data || []).length;
        const sheetCountBefore = (superSheetsBefore.data?.data || []).length;
        console.log(`   Superadmin has ${folderCountBefore} folders, ${sheetCountBefore} sheets\n`);

        // ── Step 4: Staff creates a test folder + sheet ─────────────
        const testFolderName = `__TEST_ISOLATION_FOLDER_${Date.now()}`;
        const testSheetName = `__TEST_ISOLATION_SHEET_${Date.now()}`;

        console.log("4️⃣  Staff creating test folder...");
        const folderRes = await apiCall("POST", "/folders", { name: testFolderName }, staffToken);
        testFolderId = folderRes.data?.data?.id;
        console.log(`   ✅ Staff created folder: "${testFolderName}" (id: ${testFolderId})`);

        console.log("   Staff creating test sheet...");
        const sheetRes = await apiCall("POST", "/sheets", { name: testSheetName }, staffToken);
        testSheetId = sheetRes.data?.data?.id;
        console.log(`   ✅ Staff created sheet: "${testSheetName}" (id: ${testSheetId})\n`);

        // ── Step 5: Re-fetch superadmin's My Files AFTER ────────────
        console.log("5️⃣  Fetching superadmin's My Files AFTER staff creates items...");
        const superFoldersAfter = await apiCall("GET", "/folders", null, superToken);
        const superSheetsAfter = await apiCall("GET", "/sheets?limit=1000", null, superToken);
        
        const folderCountAfter = (superFoldersAfter.data?.data || []).length;
        const sheetCountAfter = (superSheetsAfter.data?.data || []).length;
        console.log(`   Superadmin now has ${folderCountAfter} folders, ${sheetCountAfter} sheets\n`);

        // ── Step 6: Verify isolation ────────────────────────────────
        console.log("6️⃣  Running assertions...\n");

        // Check: staff folder should NOT appear in superadmin's folders
        const allSuperFolders = superFoldersAfter.data?.data || [];
        const flattenFolderIds = (nodes) => {
            let ids = [];
            for (const n of nodes) {
                ids.push(n.id);
                if (n.children) ids = ids.concat(flattenFolderIds(n.children));
            }
            return ids;
        };
        const superFolderIds = flattenFolderIds(allSuperFolders);
        
        // Test 1: Staff's folder NOT in superadmin's folder tree
        if (!superFolderIds.includes(testFolderId)) {
            console.log("   ✅ PASS: Staff's folder does NOT appear in superadmin's folder tree");
            passed++;
        } else {
            console.log("   ❌ FAIL: Staff's folder APPEARS in superadmin's folder tree!");
            failed++;
        }

        // Test 2: Staff's sheet NOT in superadmin's sheets list
        const superSheetIds = (superSheetsAfter.data?.data || []).map(s => s.id);
        if (!superSheetIds.includes(testSheetId)) {
            console.log("   ✅ PASS: Staff's sheet does NOT appear in superadmin's sheet list");
            passed++;
        } else {
            console.log("   ❌ FAIL: Staff's sheet APPEARS in superadmin's sheet list!");
            failed++;
        }

        // Test 3: Folder count should be unchanged
        if (folderCountAfter === folderCountBefore) {
            console.log("   ✅ PASS: Superadmin's folder count unchanged");
            passed++;
        } else {
            console.log(`   ❌ FAIL: Superadmin's folder count changed (${folderCountBefore} → ${folderCountAfter})`);
            failed++;
        }

        // Test 4: Sheet count should be unchanged
        if (sheetCountAfter === sheetCountBefore) {
            console.log("   ✅ PASS: Superadmin's sheet count unchanged");
            passed++;
        } else {
            console.log(`   ❌ FAIL: Superadmin's sheet count changed (${sheetCountBefore} → ${sheetCountAfter})`);
            failed++;
        }

        // Test 5: Staff CAN see their own items
        console.log("\n   Verifying staff can see their own items...");
        const staffFolders = await apiCall("GET", "/folders", null, staffToken);
        const staffSheets = await apiCall("GET", "/sheets?limit=1000", null, staffToken);
        
        const staffFolderIds = flattenFolderIds(staffFolders.data?.data || []);
        const staffSheetIds = (staffSheets.data?.data || []).map(s => s.id);
        
        if (staffFolderIds.includes(testFolderId)) {
            console.log("   ✅ PASS: Staff CAN see their own folder");
            passed++;
        } else {
            console.log("   ❌ FAIL: Staff CANNOT see their own folder!");
            failed++;
        }

        if (staffSheetIds.includes(testSheetId)) {
            console.log("   ✅ PASS: Staff CAN see their own sheet");
            passed++;
        } else {
            console.log("   ❌ FAIL: Staff CANNOT see their own sheet!");
            failed++;
        }

    } catch (err) {
        console.error("\n💥 Test error:", err.message);
        failed++;
    } finally {
        // ── Cleanup ─────────────────────────────────────────────────
        console.log("\n7️⃣  Cleanup...");
        if (testFolderId && staffToken) {
            try {
                await apiCall("DELETE", `/folders/${testFolderId}`, null, staffToken);
                console.log(`   🗑️  Deleted test folder`);
            } catch(e) { console.log("   ⚠️  Could not delete test folder"); }
        }
        if (testSheetId && staffToken) {
            try {
                await apiCall("DELETE", `/sheets/${testSheetId}`, null, staffToken);
                console.log(`   🗑️  Deleted test sheet`);
            } catch(e) { console.log("   ⚠️  Could not delete test sheet"); }
        }
    }

    // ── Summary ─────────────────────────────────────────────────────
    console.log("\n═══════════════════════════════════════════════════");
    console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
    console.log("═══════════════════════════════════════════════════");
    
    if (failed > 0) {
        console.log("\n❌ SOME TESTS FAILED — the isolation fix may not be working.\n");
        process.exit(1);
    } else {
        console.log("\n✅ ALL TESTS PASSED — My Files isolation is working correctly!\n");
        process.exit(0);
    }
}

main();
