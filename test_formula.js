import engine from './src/utils/formulaEngine.js';
const { evaluate } = engine;

const cellMap = {
    "A1": "20",
    "A2": "₹100.00",
    "B1": "10",
    "B2": "10.00%"
};

console.log("=A1+B1/A1% =>", evaluate("=A1+B1/A1%", cellMap));
console.log("=A2+B1 =>", evaluate("=A2+B1", cellMap));
console.log("=SUM(A1, B1) =>", evaluate("=SUM(A1, B1)", cellMap));
console.log("=A2 * 2 =>", evaluate("=A2 * 2", cellMap));
console.log("=B2 + A1 =>", evaluate("=B2 + A1", cellMap));
console.log("=A1+B1/A1% =>", evaluate("=A1+B1/A1%", cellMap));
