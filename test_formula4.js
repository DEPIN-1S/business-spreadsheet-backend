import engine from './src/utils/formulaEngine.js';
const { evaluate } = engine;

const cellMap = {
    "A1": "30",
    "B1": "100"
};

try { 
  console.log("=B1/(A1+70)% =>", evaluate("=B1/(A1+70)%", cellMap));
} catch(e) { 
  console.log("Error:", e.message); 
}
