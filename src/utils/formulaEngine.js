/**
 * Formula Engine
 * Evaluates spreadsheet-style formulas against a cell value map.
 * Cell value map: { "A1": 10, "B1": 20, ... } where keys are column letters + row numbers
 * OR { columnId_rowId: value } depending on how you build the map.
 *
 * Supported:
 *   =A1+B1       arithmetic
 *   =SUM(A1:A5)  range sum
 *   =AVG(A1:A5)  range average
 *   =MIN(A1:A5)  range min
 *   =MAX(A1:A5)  range max
 *   =COUNT(A1:A5) count non-empty
 *   =IF(A1>10,"High","Low")  conditional
 *   =CONCAT(A1," ",B1)  string concat
 */

// Helper to safely extract numeric values from strings like "$100.00", "₹ 500", "1,000", "10.5%"
function parseNumericValue(val) {
    if (val === undefined || val === null || val === "") return null;
    if (typeof val === "number") return val;
    const strVal = String(val).trim();
    
    if (strVal === "") return null;
    if (!isNaN(Number(strVal))) return Number(strVal);
    
    // Percentage e.g. 10%, 10.55 %
    if (/^[-+]?[\d,]+(\.\d+)?\s*%$/.test(strVal)) {
        const num = parseFloat(strVal.replace(/[^\d.-]/g, ''));
        if (!isNaN(num)) return num;  // Return face value (10 for "10%"); use % operator in formula for /100
    }
    
    // Currency / comma formatted (e.g. ₹100.00, $ 10, 1,000.50)
    const isCurrencyOrFormatted = /^[-+]?[^\w\s+-]?\s*[\d,]+(\.\d+)?\s*[^\w\s+-]?$/.test(strVal);
    if (isCurrencyOrFormatted) {
        const cleaned = strVal.replace(/[^\d.-]/g, '');
        const num = parseFloat(cleaned);
        if (!isNaN(num)) return num;
    }
    
    return null;
}

// Resolve a range like "A1:A5" to an array of cell numeric values
function expandRange(range, cellMap) {
    const match = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
    if (!match) return [];
    const [, colStart, rowStart, colEnd, rowEnd] = match;
    const values = [];

    const startColNum = colLetterToNum(colStart);
    const endColNum = colLetterToNum(colEnd);
    const startRow = parseInt(rowStart);
    const endRow = parseInt(rowEnd);

    for (let r = startRow; r <= endRow; r++) {
        for (let c = startColNum; c <= endColNum; c++) {
            const key = `${colNumToLetter(c)}${r}`;
            const num = parseNumericValue(cellMap[key]);
            if (num !== null) {
                values.push(num);
            }
        }
    }
    return values;
}

function colLetterToNum(col) {
    let num = 0;
    for (let i = 0; i < col.length; i++) {
        num = num * 26 + (col.charCodeAt(i) - 64);
    }
    return num;
}

function colNumToLetter(num) {
    let letter = "";
    while (num > 0) {
        const rem = (num - 1) % 26;
        letter = String.fromCharCode(65 + rem) + letter;
        num = Math.floor((num - 1) / 26);
    }
    return letter;
}

// Replace cell references (A1, B2, etc.) in expression with their values
function resolveCellRefs(expr, cellMap) {
    return expr.replace(/\b([A-Z]+)(\d+)\b/g, (match) => {
        const val = cellMap[match];
        if (val === undefined || val === null || val === "") return "0";
        const num = parseNumericValue(val);
        // Non-numeric values coerce to 0 in arithmetic to prevent NaN / string concat
        return num !== null ? String(num) : "0";
    });
}

// Preprocess expression: implied multiplication and percentage conversion
function preprocessExpression(expr) {
    if (!expr) return "";
    
    let processed = expr
        .replace(/(\d)\s*\(/g, '$1*(')      // 2( -> 2*(
        .replace(/\)\s*(\d)/g, ')*$1')      // )2 -> )*2
        .replace(/\)\s*\(/g, ')*(');         // )( -> )*(

    // Convert percentages within expressions: e.g. 10% -> (10/100)
    processed = processed.replace(/(\d+(?:\.\d+)?)\s*%/g, '($1/100)');

    // Convert (expr)% -> ((expr)/100)
    while (processed.includes(")%")) {
        const idx = processed.indexOf(")%");
        let openIdx = -1;
        let depth = 0;
        for (let i = idx - 1; i >= 0; i--) {
            if (processed[i] === ')') depth++;
            else if (processed[i] === '(') {
                if (depth === 0) { openIdx = i; break; }
                depth--;
            }
        }
        if (openIdx !== -1) {
            processed = processed.substring(0, openIdx) + "((" + processed.substring(openIdx + 1, idx) + ")/100)" + processed.substring(idx + 2);
        } else {
            processed = processed.replace(")%", ")/100");
        }
    }
    
    return processed;
}

// Safe numeric evaluator (no eval) using Function constructor with strict whitelist check
function safeEval(expr) {
    // Allow only safe characters: digits, operators, parens, spaces, dots, quotes, commas, modulo
    const safe = /^[\d\s+\-*/%().,<>=!"&|?:'"a-zA-Z_]+$/.test(expr);
    if (!safe) throw new Error(`Unsafe formula expression: ${expr}`);
    const processed = preprocessExpression(expr);
    if (expr !== processed) console.log(`[FormulaEngine] Processed expression: "${expr}" -> "${processed}"`);
    try {
        // eslint-disable-next-line no-new-func
        const result = Function(`"use strict"; return (${processed})`)();
        // Guard: division by zero produces Infinity, coerce to 0
        if (typeof result === "number" && !isFinite(result)) return 0;
        return result;
    } catch (e) {
        throw new Error(`Cannot evaluate expression: ${expr} (Reason: ${e.message})`);
    }
}

/**
 * Main evaluate function
 * @param {string} formula  - raw formula string e.g. "=SUM(A1:A5)" or "=A1+B1"
 * @param {object} cellMap  - { "A1": "10", "B1": "5", ... }
 * @returns {string|number}  computed value
 */
export function evaluate(formula, cellMap = {}) {
    if (!formula || !formula.startsWith("=")) return formula;

    let expr = formula.slice(1).trim(); // remove leading =

    // --- SUM(range) ---
    expr = expr.replace(/SUM\(([^)]+)\)/g, (_, range) => {
        if (range.includes(":")) {
            const vals = expandRange(range.trim(), cellMap);
            return vals.reduce((a, b) => a + b, 0);
        }
        return range.split(",").reduce((acc, r) => acc + (parseNumericValue(cellMap[r.trim()]) || 0), 0);
    });

    // --- AVG(range) ---
    expr = expr.replace(/AVG\(([^)]+)\)/g, (_, range) => {
        const vals = expandRange(range.trim(), cellMap);
        return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
    });

    // --- MIN(range) ---
    expr = expr.replace(/MIN\(([^)]+)\)/g, (_, range) => {
        const vals = expandRange(range.trim(), cellMap);
        return vals.length ? Math.min(...vals) : 0;
    });

    // --- MAX(range) ---
    expr = expr.replace(/MAX\(([^)]+)\)/g, (_, range) => {
        const vals = expandRange(range.trim(), cellMap);
        return vals.length ? Math.max(...vals) : 0;
    });

    // --- COUNT(range) ---
    expr = expr.replace(/COUNT\(([^)]+)\)/g, (_, range) => {
        const vals = expandRange(range.trim(), cellMap);
        return vals.length;
    });

    // --- CONVERT_CURRENCY(value, fromCode, toCode, rate) ---
    expr = expr.replace(/CONVERT_CURRENCY\(([^)]+)\)/g, (_, args) => {
        const parts = splitArgs(args);
        const value = parseFloat(resolveCellRefs(parts[0].trim(), cellMap)) || 0;
        const rate = parseFloat(resolveCellRefs(parts[3].trim(), cellMap)) || 1;
        return value * rate;
    });

    // --- CONCAT(a, b, ...) ---
    expr = expr.replace(/CONCAT\(([^)]+)\)/g, (_, args) => {
        const parts = args.split(",").map(a => {
            const k = a.trim().replace(/"/g, "");
            return cellMap[k] !== undefined ? cellMap[k] : k;
        });
        return `"${parts.join("")}"`;
    });

    // --- IF(condition, trueVal, falseVal) ---
    expr = expr.replace(/IF\((.+)\)$/, (_, inner) => {
        // Split on first two commas not inside quotes
        const parts = splitArgs(inner);
        if (parts.length < 3) throw new Error("IF requires 3 arguments");
        const condition = resolveCellRefs(parts[0], cellMap);
        const trueVal = parts[1].trim();
        const falseVal = parts[2].trim();
        const condResult = safeEval(preprocessExpression(condition));
        return condResult ? trueVal : falseVal;
    });

    // --- TODAY() ---
    expr = expr.replace(/TODAY\(\)/gi, () => {
        return `"${new Date().toISOString().slice(0, 10)}"`;
    });

    // --- NOW() ---
    expr = expr.replace(/NOW\(\)/gi, () => {
        const d = new Date();
        return `"${d.toISOString().slice(0, 10)} ${d.toTimeString().slice(0, 8)}"`;
    });

    // --- DATEDIFF(startDate, endDate) → number of days ---
    expr = expr.replace(/DATEDIFF\(([^)]+)\)/gi, (_, args) => {
        const parts = splitArgs(args);
        if (parts.length < 2) return 0;
        // Resolve cell refs directly from cellMap to preserve date strings
        const resolveDate = (part) => {
            const p = part.trim().replace(/"/g, '');
            const cellRef = p.match(/^[A-Z]+\d+$/);
            return cellRef ? (cellMap[p] ?? '') : p;
        };
        const d1Str = resolveDate(parts[0]);
        const d2Str = resolveDate(parts[1]);
        const ms = new Date(d2Str) - new Date(d1Str);
        return isNaN(ms) ? 0 : Math.round(ms / 86400000);
    });

    // --- DATEADD(date, days) → new date string ---
    expr = expr.replace(/DATEADD\(([^)]+)\)/gi, (_, args) => {
        const parts = splitArgs(args);
        if (parts.length < 2) return `""`;
        // Resolve date from cellMap directly
        const datePart = parts[0].trim().replace(/"/g, '');
        const cellRef = datePart.match(/^[A-Z]+\d+$/);
        const dateStr = cellRef ? (cellMap[datePart] ?? '') : datePart;
        // Resolve days (can be a cell ref or number)
        const daysPart = parts[1].trim().replace(/"/g, '');
        const daysRef = daysPart.match(/^[A-Z]+\d+$/);
        const days = parseFloat(daysRef ? (cellMap[daysPart] ?? 0) : daysPart) || 0;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return `""`;
        d.setDate(d.getDate() + days);
        return `"${d.toISOString().slice(0, 10)}"`;
    });

    // Resolve remaining cell refs
    expr = resolveCellRefs(expr, cellMap);

    // Final evaluation with preprocessing (implied mult, percentages)
    let result = safeEval(preprocessExpression(expr));
    if (typeof result === "number" && !isNaN(result)) {
        // Round to 1 decimal place as per user requirement
        result = parseFloat(result.toFixed(1));
    } else if (typeof result === "number" && isNaN(result)) {
        // Guard: NaN from invalid arithmetic → return 0
        result = 0;
    }
    return result;
}

// Split function arguments respecting nested parens and quoted strings
function splitArgs(str) {
    const args = [];
    let depth = 0;
    let inStr = false;
    let current = "";
    for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (ch === '"' && str[i - 1] !== "\\") inStr = !inStr;
        if (!inStr && ch === "(") depth++;
        if (!inStr && ch === ")") depth--;
        if (!inStr && depth === 0 && ch === ",") {
            args.push(current.trim());
            current = "";
        } else {
            current += ch;
        }
    }
    if (current.trim()) args.push(current.trim());
    return args;
}

/**
 * Resolve column name references in a formula to A1-notation cell refs.
 * E.g. for formula "=test+test2", columns [{name:"test", idx:0}, {name:"test2", idx:1}], rowIndex 0
 *   → "=A1+B1"
 *
 * @param {string} formula    - raw formula string e.g. "=test+test2%10"
 * @param {Array}  columns    - array of { name, colLetter } where colLetter is the A/B/C letter
 * @param {number} rowNumber  - 1-based row number
 * @returns {string} formula with column names replaced by cell refs
 */
export function resolveColumnNames(formula, columns, rowNumber) {
    if (!formula) return formula;

    let result = formula;

    // Sort columns by name length descending to avoid partial matches
    // e.g. "test2" should be replaced before "test"
    const sorted = [...columns].sort((a, b) => b.name.length - a.name.length);

    for (const col of sorted) {
        let colName = col.name.trim();
        if (!colName) continue;
        
        // Use lookarounds instead of word boundaries (\b) to support special characters at borders
        // This ensures "pr" does not replace inside "price"
        const regex = new RegExp(`(?<=^|[^a-zA-Z0-9_])${escapeRegExp(colName)}(?=$|[^a-zA-Z0-9_])`, "gi");
        result = result.replace(regex, `${col.colLetter}${rowNumber}`);
    }

    return result;
}

function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default { evaluate, resolveColumnNames };
