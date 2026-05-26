/**
 * Test: Admin-wide Shared View & Staff Isolation
 * 
 * Verifies that:
 *   1. Sheets/folders created by one superadmin are visible to another superadmin in "My Files".
 *   2. Sheets/folders created by superadmins are NOT visible to staff users in their "My Files".
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
    await apiCall("POST", "/user/send-otp", { phone });
    const res = await apiCall("POST", "/user/verify-otp", { phone, otp: "1234" });
    if (!res.data?.data?.accessToken) throw new Error(`Login failed for ${phone}`);
    return { token: res.data.data.accessToken, user: res.data.data.user };
}

async function main() {
    console.log("═══════════════════════════════════════════════════════════");
    console.log("  TEST: Admin-wide My Files Shared View & Staff Isolation");
    console.log("═══════════════════════════════════════════════════════════\n");

    let passed = 0, failed = 0;
    let testSheetId = null;
    let testFolderId = null;

    let superadmin1, superadmin2, staff;

    try {
        // Login as both superadmins and a staff
        superadmin1 = await login("8606475372"); // deiju
        console.log(`✅ Superadmin 1: ${superadmin1.user.name} (${superadmin1.user.role})`);
        
        superadmin2 = await login("8848804828"); // bmusafir
        console.log(`✅ Superadmin 2: ${superadmin2.user.name} (${superadmin2.user.role})`);
        
        staff = await login("9074054046"); // Depin S
        console.log(`✅ Staff: ${staff.user.name} (${staff.user.role})\n`);

        // ── Step 1: Superadmin 2 creates a sheet and a folder ────────
        const sheetName = `__ADMIN_SHARED_SHEET_${Date.now()}`;
        console.log(`1️⃣  Superadmin 2 (${superadmin2.user.name}) creates sheet "${sheetName}"...`);
        const sheetRes = await apiCall("POST", "/sheets", { name: sheetName }, superadmin2.token);
        testSheetId = sheetRes.data?.data?.id;
        console.log(`   Sheet created with id: ${testSheetId}`);

        const folderName = `__ADMIN_SHARED_FOLDER_${Date.now()}`;
        console.log(`2️⃣  Superadmin 2 (${superadmin2.user.name}) creates folder "${folderName}"...`);
        const folderRes = await apiCall("POST", "/folders", { name: folderName }, superadmin2.token);
        testFolderId = folderRes.data?.data?.id;
        console.log(`   Folder created with id: ${testFolderId}\n`);

        // ── Step 2: Superadmin 1 checks their My Files ───────────────
        console.log(`3️⃣  Superadmin 1 (${superadmin1.user.name}) fetches My Files...`);
        
        // Fetch sheets
        const sa1SheetsRes = await apiCall("GET", "/sheets?limit=1000", null, superadmin1.token);
        const sa1Sheets = sa1SheetsRes.data?.data || [];
        const foundSheet = sa1Sheets.find(s => s.id === testSheetId);
        
        if (foundSheet) {
            console.log(`   ✅ PASS: Superadmin 1 CAN see the sheet created by Superadmin 2!`);
            passed++;
        } else {
            console.log(`   ❌ FAIL: Superadmin 1 CANNOT see the sheet created by Superadmin 2.`);
            failed++;
        }

        // Fetch folders
        const sa1FoldersRes = await apiCall("GET", "/folders", null, superadmin1.token);
        const sa1Folders = sa1FoldersRes.data?.data || [];
        const foundFolder = sa1Folders.find(f => f.id === testFolderId);
        
        if (foundFolder) {
            console.log(`   ✅ PASS: Superadmin 1 CAN see the folder created by Superadmin 2!`);
            passed++;
        } else {
            console.log(`   ❌ FAIL: Superadmin 1 CANNOT see the folder created by Superadmin 2.`);
            failed++;
        }

        // ── Step 3: Staff checks their My Files (should NOT see them) ──────
        console.log(`\n4️⃣  Staff checks My Files (should NOT see admin items)...`);
        
        // Fetch sheets
        const staffSheetsRes = await apiCall("GET", "/sheets?limit=1000", null, staff.token);
        const staffSheets = staffSheetsRes.data?.data || [];
        const staffFoundSheet = staffSheets.find(s => s.id === testSheetId);
        
        if (!staffFoundSheet) {
            console.log(`   ✅ PASS: Staff cannot see superadmin's sheet.`);
            passed++;
        } else {
            console.log(`   ❌ FAIL: Staff CAN see superadmin's sheet!`);
            failed++;
        }

        // Fetch folders
        const staffFoldersRes = await apiCall("GET", "/folders", null, staff.token);
        const staffFolders = staffFoldersRes.data?.data || [];
        const staffFoundFolder = staffFolders.find(f => f.id === testFolderId);
        
        if (!staffFoundFolder) {
            console.log(`   ✅ PASS: Staff cannot see superadmin's folder.`);
            passed++;
        } else {
            console.log(`   ❌ FAIL: Staff CAN see superadmin's folder!`);
            failed++;
        }

    } catch (err) {
        console.error("\n💥 Test execution error:", err.message);
        failed++;
    } finally {
        // Cleanup
        console.log("\n🧹 Cleaning up test folders/sheets...");
        if (testSheetId) await apiCall("DELETE", `/sheets/${testSheetId}`, null, superadmin2.token);
        if (testFolderId) await apiCall("DELETE", `/folders/${testFolderId}`, null, superadmin2.token);
        console.log("   Cleanup completed.");
    }

    console.log("\n═══════════════════════════════════════════════════════════");
    console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
    console.log("═══════════════════════════════════════════════════════════");
    process.exit(failed > 0 ? 1 : 0);
}

main();
