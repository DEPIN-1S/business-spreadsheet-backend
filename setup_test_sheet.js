/**
 * Setup Script: Create a spreadsheet with 3 columns (sr, pr, result) and 10 rows
 * Then verify the percentage formula calculation works correctly.
 *
 * Columns:
 *   1. sr     (number)  — base/selling rate
 *   2. pr     (number)  — profit rate (percentage value, e.g. 10 means 10%)
 *   3. result (formula) — =sr * (1 + pr / 100)
 *
 * Run: node setup_test_sheet.js
 */

const BASE = "http://localhost:6041/api";

async function api(method, path, body, token) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${BASE}${path}`, {
        method, headers,
        body: body ? JSON.stringify(body) : undefined
    });
    const json = await res.json();
    if (!res.ok) {
        console.error(`[${res.status}] ${method} ${path}:`, JSON.stringify(json));
        throw new Error(`API error: ${res.status}`);
    }
    return json;
}

async function main() {
    console.log("\n=== SETUP: Create Test Spreadsheet ===\n");

    // 1. Login as superadmin
    console.log("1. Logging in as superadmin...");
    const loginRes = await api("POST", "/user/login", {
        email: "depinadmin@gmail.com",
        password: "superadmin@123"
    });
    const token = loginRes.data?.token || loginRes.data?.accessToken || loginRes.token;
    if (!token) {
        console.error("Login response:", JSON.stringify(loginRes, null, 2));
        throw new Error("Could not extract token from login response");
    }
    console.log("   Logged in successfully.\n");

    // 2. Create spreadsheet
    console.log("2. Creating spreadsheet 'Percentage Test'...");
    const sheetRes = await api("POST", "/admin/sheets", {
        name: "Percentage Test",
        description: "Test spreadsheet with sr, pr, and formula result columns"
    }, token);
    const sheetId = sheetRes.data?.id;
    console.log(`   Sheet ID: ${sheetId}\n`);

    // 3. Add 3 columns: sr (number), pr (number), result (formula)
    console.log("3. Adding 3 columns...");

    const col1Res = await api("POST", `/admin/sheets/${sheetId}/columns`, {
        name: "sr", type: "number", orderIndex: 0
    }, token);
    const srColId = col1Res.data?.id;
    console.log(`   Column 'sr'     ID: ${srColId}`);

    const col2Res = await api("POST", `/admin/sheets/${sheetId}/columns`, {
        name: "pr", type: "number", orderIndex: 1
    }, token);
    const prColId = col2Res.data?.id;
    console.log(`   Column 'pr'     ID: ${prColId}`);

    const col3Res = await api("POST", `/admin/sheets/${sheetId}/columns`, {
        name: "result", type: "formula", orderIndex: 2,
        formulaExpr: "=sr*(1+pr/100)"
    }, token);
    const resultColId = col3Res.data?.id;
    console.log(`   Column 'result' ID: ${resultColId}\n`);

    // 4. Add 10 rows with test data
    console.log("4. Adding 10 rows with test data...");
    const testData = [
        { sr: 1000,  pr: 10 },    // Expected result: 1100
        { sr: 2000,  pr: 20 },    // Expected: 2400
        { sr: 500,   pr: 15 },    // Expected: 575
        { sr: 1500,  pr: 5 },     // Expected: 1575
        { sr: 3000,  pr: 25 },    // Expected: 3750
        { sr: 750,   pr: 8 },     // Expected: 810
        { sr: 100,   pr: 50 },    // Expected: 150
        { sr: 5000,  pr: 12 },    // Expected: 5600
        { sr: 250,   pr: 30 },    // Expected: 325
        { sr: 10000, pr: 7 },     // Expected: 10700
    ];

    const rowIds = [];
    for (let i = 0; i < testData.length; i++) {
        const rowRes = await api("POST", `/sheets/${sheetId}/rows`, {}, token);
        const rowId = rowRes.data?.id;
        rowIds.push(rowId);

        // Upsert sr cell
        await api("POST", `/sheets/${sheetId}/cells`, {
            rowId, columnId: srColId,
            rawValue: String(testData[i].sr)
        }, token);

        // Upsert pr cell
        await api("POST", `/sheets/${sheetId}/cells`, {
            rowId, columnId: prColId,
            rawValue: String(testData[i].pr)
        }, token);

        console.log(`   Row ${i + 1}: sr=${testData[i].sr}, pr=${testData[i].pr} (rowId: ${rowId})`);
    }

    console.log("\n5. Fetching sheet data to verify formula results...\n");

    // 5. Fetch sheet and check computed values
    const dataRes = await api("GET", `/sheets/${sheetId}/data?limit=20`, null, token);
    const grid = dataRes.data?.grid;

    console.log("   +-------+-------+------+----------+----------+--------+");
    console.log("   |  Row  |   sr  |  pr  | Expected |  Actual  | Status |");
    console.log("   +-------+-------+------+----------+----------+--------+");

    let allCorrect = true;
    for (let i = 0; i < grid.length; i++) {
        const cells = grid[i].cells;
        const srCell = cells.find(c => c.columnId === srColId);
        const prCell = cells.find(c => c.columnId === prColId);
        const resultCell = cells.find(c => c.columnId === resultColId);

        const sr = parseFloat(srCell?.computedValue || srCell?.rawValue || 0);
        const pr = parseFloat(prCell?.computedValue || prCell?.rawValue || 0);
        const expected = sr * (1 + pr / 100);
        const actual = parseFloat(resultCell?.computedValue || 0);

        const match = Math.abs(expected - actual) < 0.01;
        if (!match) allCorrect = false;

        const status = match ? "PASS" : "FAIL";
        console.log(`   |  ${String(i + 1).padStart(2)}   | ${String(sr).padStart(5)} | ${String(pr).padStart(4)} | ${String(expected).padStart(8)} | ${String(actual).padStart(8)} | ${status.padStart(4)}   |`);
    }
    console.log("   +-------+-------+------+----------+----------+--------+");

    if (allCorrect) {
        console.log("\n   ALL 10 ROWS CORRECT! Formula =sr*(1+pr/100) works perfectly.\n");
    } else {
        console.log("\n   SOME ROWS FAILED! Check formula logic.\n");
    }

    console.log(`\nSheet URL: http://localhost:5173 (open and navigate to 'Percentage Test')`);
    console.log(`Sheet ID:  ${sheetId}\n`);
}

main().catch(err => {
    console.error("\nFATAL:", err.message);
    process.exit(1);
});
