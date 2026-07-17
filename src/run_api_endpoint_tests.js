import jwt from "jsonwebtoken";
import http from "http";
import dotenv from "dotenv";
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "dkjghkdghfhglknghdxlkdnflsfjopoijoigjhpokp";
const token = jwt.sign({ id: "77777777-7777-7777-7777-777777777777", role: "superadmin" }, JWT_SECRET);

const apiTests = [
    { name: "List Folders", path: "/api/inv-folders" },
    { name: "List Sheets", path: "/api/inv-sheets" },
    { name: "List Active Batches (billing list)", path: "/api/inv-sheets/batches" },
    { name: "List GST Options", path: "/api/inv/masters/gst" },
    { name: "List Categories Options", path: "/api/inv/masters/categories" },
    { name: "List Retail Parties", path: "/api/inv/parties/retail" },
    { name: "List Wholesale Parties", path: "/api/inv/parties/wholesale" },
    { name: "List Invoices", path: "/api/inv/invoices" },
    { name: "List Ledger Entries", path: "/api/inv/ledger" },
    { name: "List Notifications", path: "/api/inv/notifications" }
];

function testRequest(name, path) {
    return new Promise((resolve) => {
        const options = {
            hostname: "localhost",
            port: 6041,
            path: path,
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        };

        const req = http.request(options, (res) => {
            let body = "";
            res.on("data", (chunk) => { body += chunk; });
            res.on("end", () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(body);
                } catch {}
                resolve({
                    name,
                    path,
                    statusCode: res.statusCode,
                    success: res.statusCode >= 200 && res.statusCode < 300,
                    dataCount: parsed && parsed.data ? (Array.isArray(parsed.data) ? parsed.data.length : 1) : 0
                });
            });
        });

        req.on("error", (err) => {
            resolve({
                name,
                path,
                statusCode: 0,
                success: false,
                error: err.message
            });
        });

        req.end();
    });
}

async function runAllTests() {
    console.log("Running Live HTTP API Endpoints Tests...");
    console.log("=========================================");
    
    const results = [];
    for (const test of apiTests) {
        const res = await testRequest(test.name, test.path);
        results.push(res);
    }

    console.log("\nAPI ENDPOINTS TEST REPORT:");
    console.log("----------------------------------------------------------------------");
    console.log(String("API Name").padEnd(35) + " | " + String("Status").padEnd(6) + " | " + String("Count").padEnd(5) + " | Path");
    console.log("----------------------------------------------------------------------");
    
    let allPassed = true;
    for (const r of results) {
        const statusText = r.success ? "✅ OK " : `❌ ERR(${r.statusCode})`;
        if (!r.success) allPassed = false;
        const countText = r.dataCount !== undefined ? String(r.dataCount) : "N/A";
        console.log(r.name.padEnd(35) + " | " + statusText.padEnd(6) + " | " + countText.padEnd(5) + " | " + r.path);
    }
    console.log("----------------------------------------------------------------------");
    
    if (allPassed) {
        console.log("\n🎉 SUCCESS: All inventory endpoints tested successfully!");
        process.exit(0);
    } else {
        console.error("\n❌ FAILED: Some inventory endpoints failed to respond properly.");
        process.exit(1);
    }
}

runAllTests();
