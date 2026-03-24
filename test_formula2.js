import engine from './src/utils/formulaEngine.js';
const { evaluate } = engine;

const cellMap = {
    "A1": "20",
    "B1": "10",
    "C1": "20",
    "D1": "0",  // sr
    "E1": "0"   // pr
};

try { console.log("=D1+E1/D1% =>", evaluate("=D1+E1/D1%", cellMap)); } catch(e) { console.log(e.message); }
try { console.log("=A1+B1/A1% =>", evaluate("=A1+B1/A1%", cellMap)); } catch(e) { console.log(e.message); }

const cellMap2 = {
  "A1": "0",
  "B1": "0"
};
try { console.log("0+0/0% =>", evaluate("=A1+B1/A1%", cellMap2)); } catch(e) { console.log(e.message); }

// Test invalid characters that UI might send
const cellMap3 = {
  "A1": "₹100.00",
  "B1": "20"
};
try { console.log("Currency % =>", evaluate("=B1+A1%", cellMap3)); } catch(e) { console.log(e.message); }

// What if string has `%` naturally but without digits?
const cellMap4 = {
  "A1": "20%",
  "B1": "10%"
};
try { console.log("Cell with % =>", evaluate("=A1+B1", cellMap4)); } catch(e) { console.log(e.message); }
