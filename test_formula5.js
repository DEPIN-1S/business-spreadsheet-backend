import engine from './src/utils/formulaEngine.js';
const { evaluate } = engine;

const cellMap = {
    "A2": "477.05",
    "B2": "3.770"
};

try { 
  console.log("=A2+B2/A2% =>", evaluate("=A2+B2/A2%", cellMap));
} catch(e) { 
  console.log("Error:", e.message); 
}
