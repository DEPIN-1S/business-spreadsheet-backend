/**
 * Test: Custom Duplicate Name verification for sheets and folders
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
    console.log("  TEST: Custom Duplicate Names (Sheets + Folders)");
    console.log("═══════════════════════════════════════════════════════════\n");

    let passed = 0, failed = 0;
    let testSheetId = null;
    let dupSheetId = null;
    let testFolderId = null;
    let dupFolderId = null;

    const superadmin = await login("8606475372");
    console.log(`✅ Superadmin logged in: ${superadmin.user.name}\n`);

    try {
        // ── 1. Duplicate Sheet with Custom Name ─────────────────────
        console.log("1️⃣  Creating original test sheet...");
        const originalName = `__ORIGINAL_SHEET_${Date.now()}`;
        const sheetRes = await apiCall("POST", "/sheets", { name: originalName }, superadmin.token);
        testSheetId = sheetRes.data?.data?.id;
        console.log(`   Created original: "${originalName}" (id: ${testSheetId})`);

        console.log("2️⃣  Duplicating sheet with a custom name...");
        const customSheetName = `__CUSTOM_DUP_SHEET_${Date.now()}`;
        const dupRes = await apiCall("POST", `/sheets/${testSheetId}/duplicate`, { name: customSheetName }, superadmin.token);
        dupSheetId = dupRes.data?.data?.id;
        console.log(`   Duplicated result status: ${dupRes.status}`);
        
        if (dupRes.status === 201 && dupRes.data?.data?.name === customSheetName) {
            console.log(`   ✅ PASS: Sheet duplicated successfully with custom name: "${dupRes.data.data.name}"`);
            passed++;
        } else {
            console.log(`   ❌ FAIL: Sheet duplication failed or name mismatched. Got name: "${dupRes.data?.data?.name}"`);
            failed++;
        }

        // ── 2. Duplicate Folder with Custom Name ────────────────────
        console.log("\n3️⃣  Creating original test folder...");
        const originalFolderName = `__ORIGINAL_FOLDER_${Date.now()}`;
        const folderRes = await apiCall("POST", "/folders", { name: originalFolderName }, superadmin.token);
        testFolderId = folderRes.data?.data?.id;
        console.log(`   Created original folder: "${originalFolderName}" (id: ${testFolderId})`);

        console.log("4️⃣  Duplicating folder with a custom name...");
        const customFolderName = `__CUSTOM_DUP_FOLDER_${Date.now()}`;
        const dupFolderRes = await apiCall("POST", `/folders/${testFolderId}/duplicate`, { name: customFolderName }, superadmin.token);
        dupFolderId = dupFolderRes.data?.data?.id;
        console.log(`   Duplicated folder result status: ${dupFolderRes.status}`);

        if (dupFolderRes.status === 201 && dupFolderRes.data?.data?.name === customFolderName) {
            console.log(`   ✅ PASS: Folder duplicated successfully with custom name: "${dupFolderRes.data.data.name}"`);
            passed++;
        } else {
            console.log(`   ❌ FAIL: Folder duplication failed or name mismatched. Got name: "${dupFolderRes.data?.data?.name}"`);
            failed++;
        }

    } catch (err) {
        console.error("\n💥 Error running tests:", err.message);
        failed++;
    } finally {
        console.log("\n🧹 Cleaning up test items...");
        if (testSheetId) await apiCall("DELETE", `/sheets/${testSheetId}`, null, superadmin.token);
        if (dupSheetId) await apiCall("DELETE", `/sheets/${dupSheetId}`, null, superadmin.token);
        if (testFolderId) await apiCall("DELETE", `/folders/${testFolderId}`, null, superadmin.token);
        if (dupFolderId) await apiCall("DELETE", `/folders/${dupFolderId}`, null, superadmin.token);
        console.log("   Cleanup completed.");
    }

    console.log("\n═══════════════════════════════════════════════════════════");
    console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
    console.log("═══════════════════════════════════════════════════════════");
    process.exit(failed > 0 ? 1 : 0);
}

main();
