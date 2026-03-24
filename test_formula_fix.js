import engine from './src/utils/formulaEngine.js';
const { evaluate } = engine;

let passed = 0;
let failed = 0;

function test(name, formula, cellMap, expected) {
    try {
        const result = evaluate(formula, cellMap);
        const ok = typeof expected === 'function' ? expected(result) : result === expected;
        if (ok) {
            console.log(`  ✅ ${name}: ${formula} => ${result}`);
            passed++;
        } else {
            console.log(`  ❌ ${name}: ${formula} => ${result} (expected ${expected})`);
            failed++;
        }
    } catch (e) {
        console.log(`  ❌ ${name}: ${formula} => ERROR: ${e.message}`);
        failed++;
    }
}

console.log("\n=== PERCENTAGE FORMULA FIX TESTS ===\n");

// --- 1. Percentage increase (pr is a percentage cell: "10%") ---
console.log("--- Percentage Increase ---");
test("sr*(1+pr/100) with pr='10%'",
    "=A1*(1+B1/100)",
    { A1: "1000", B1: "10%" },
    1100
);

// --- 2. Percentage increase (pr is plain number) ---
test("sr*(1+pr/100) with pr='10'",
    "=A1*(1+B1/100)",
    { A1: "1000", B1: "10" },
    1100
);

// --- 3. Absolute addition ---
test("sr+pr absolute",
    "=A1+B1",
    { A1: "1000", B1: "50" },
    1050
);

// --- 4. Division by zero protection ---
console.log("\n--- Division by Zero ---");
test("A1/B1 where B1=0",
    "=A1/B1",
    { A1: "10", B1: "0" },
    0
);

test("A1/(B1-B1) zero denominator",
    "=A1/(B1-B1)",
    { A1: "100", B1: "5" },
    0
);

// --- 5. NaN protection ---
console.log("\n--- NaN Protection ---");
test("A1+B1 where A1 is non-numeric",
    "=A1+B1",
    { A1: "abc", B1: "10" },
    (r) => typeof r === 'number' && !isNaN(r)
);

// --- 6. SUM with percentage cells ---
console.log("\n--- SUM with Percentages ---");
test("SUM of percentage cells",
    "=SUM(A1:A3)",
    { A1: "10%", A2: "20%", A3: "30%" },
    60
);

// --- 7. Inline % operator ---
console.log("\n--- Inline % Operator ---");
test("Inline 50%",
    "=50%",
    {},
    0.5
);

test("Inline A1 * 10%",
    "=A1*10%",
    { A1: "200" },
    20
);

// --- 8. Currency + percentage ---
console.log("\n--- Currency + Percentage ---");
test("Currency sr*(1+pr/100)",
    "=A1*(1+B1/100)",
    { A1: "₹1000", B1: "10%" },
    1100
);

// --- 9. Zero base, zero rate ---
console.log("\n--- Edge Cases ---");
test("Zero base, zero rate",
    "=A1*(1+B1/100)",
    { A1: "0", B1: "0" },
    0
);

test("sr + sr*pr/100 alternative formula",
    "=A1+A1*B1/100",
    { A1: "1000", B1: "10" },
    1100
);

test("sr + sr*pr/100 with pr='10%'",
    "=A1+A1*B1/100",
    { A1: "1000", B1: "10%" },
    1100
);

// --- 10. Consistent across multiple row simulations ---
console.log("\n--- Consistency Across Rows ---");
const rows = [
    { A1: "500",  B1: "10" },
    { A1: "1000", B1: "20" },
    { A1: "2000", B1: "5" },
    { A1: "750",  B1: "15" },
];
const expectedResults = [550, 1200, 2100, 862.5];
rows.forEach((cellMap, i) => {
    test(`Row ${i+1}: sr=${cellMap.A1}, pr=${cellMap.B1}`,
        "=A1*(1+B1/100)",
        cellMap,
        expectedResults[i]
    );
});

// --- Summary ---
console.log(`\n${"=".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed}`);
console.log(`${"=".repeat(40)}\n`);

process.exit(failed > 0 ? 1 : 0);
