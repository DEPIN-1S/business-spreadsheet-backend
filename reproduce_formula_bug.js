// reproduction of formula bug: 250+(567/100)5
import { evaluate } from './src/utils/formulaEngine.js';

const cases = [
    { formula: "=250+(567/100)5", expected: 278.4 }, // 250 + 5.67*5 = 250 + 28.35 = 278.35 -> 278.4 (rounded)
    { formula: "=10(5)", expected: 50 },
    { formula: "=(2)3", expected: 6 },
    { formula: "=(2)(3)", expected: 6 },
    { formula: "=394.5949494", expected: 394.6 }
];

console.log("Starting Formula Bug Reproduction...");

cases.forEach(c => {
    try {
        const result = evaluate(c.formula, {});
        console.log(`Formula: ${c.formula} | Expected: ${c.expected} | Result: ${result}`);
        if (result !== c.expected) {
            console.error(`FAILED: ${c.formula}`);
        } else {
            console.log(`PASSED: ${c.formula}`);
        }
    } catch (e) {
        console.error(`ERROR: ${c.formula} -> ${e.message}`);
    }
});
