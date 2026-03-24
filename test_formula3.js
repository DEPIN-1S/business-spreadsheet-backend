import engine from './src/utils/formulaEngine.js';
const { evaluate } = engine;

const cellMap = {
    "A4": "956.74774",
    "B4": "64785.768"
};

try { 
  console.log("val =>", evaluate("=B4+A4/B4%", cellMap));
} catch(e) { 
  console.log("Error:", e.message); 
}
