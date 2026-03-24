import engine from './src/utils/formulaEngine.js';
const { evaluate } = engine;

let passed = 0, failed = 0;
function check(name, formula, cellMap, validator) {
    try {
        const result = evaluate(formula, cellMap);
        const ok = typeof validator === 'function' ? validator(result) : result === validator;
        if (ok) { console.log(`  [PASS] ${name}: ${formula} => ${result}`); passed++; }
        else { console.log(`  [FAIL] ${name}: ${formula} => ${result} (expected: ${validator})`); failed++; }
    } catch (e) { console.log(`  [FAIL] ${name}: ERROR ${e.message}`); failed++; }
}

console.log("\n=== DATE FORMULA TESTS ===\n");

// TODAY()
const today = new Date().toISOString().slice(0, 10);
check("TODAY()", "=TODAY()", {}, today);

// NOW() — just check it returns a string with today's date
check("NOW()", "=NOW()", {}, (r) => typeof r === 'string' && r.startsWith(today));

// DATEDIFF with cell refs
check("DATEDIFF(cells)", "=DATEDIFF(A1,B1)",
    { A1: "2026-01-01", B1: "2026-01-31" }, 30);

check("DATEDIFF(literals)", '=DATEDIFF("2026-01-01","2026-12-31")', {}, 364);

check("DATEDIFF negative", "=DATEDIFF(A1,B1)",
    { A1: "2026-03-20", B1: "2026-03-10" }, -10);

// DATEADD
check("DATEADD +30", "=DATEADD(A1,30)",
    { A1: "2026-01-01" }, "2026-01-31");

check("DATEADD +365", "=DATEADD(A1,365)",
    { A1: "2026-01-01" }, "2027-01-01");

check("DATEADD -7", "=DATEADD(A1,-7)",
    { A1: "2026-03-19" }, "2026-03-12");

// Invalid date
check("DATEADD invalid", '=DATEADD("abc",5)', {}, "");

// Existing formulas still work
check("Existing: SUM", "=SUM(A1:A3)", { A1: "10", A2: "20", A3: "30" }, 60);
check("Existing: sr*(1+pr/100)", "=A1*(1+B1/100)", { A1: "1000", B1: "10" }, 1100);
check("Existing: division by zero", "=A1/B1", { A1: "10", B1: "0" }, 0);

console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed}\n`);
process.exit(failed > 0 ? 1 : 0);
