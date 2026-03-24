/**
 * Dependency Graph utility
 * Detects circular dependencies in formula column expressions
 * and produces topological order for recalculation.
 *
 * Usage:
 *   const graph = buildGraph(columns);
 *   checkCircular(graph, columnId); // throws if circular
 *   const order = topoSort(graph);  // evaluation order
 */

// Parse cell/column references from a formula expression
export function extractRefs(formulaExpr) {
    if (!formulaExpr) return [];
    const refs = [];
    // Match column letter references like A, B, C or A1 style
    const matches = formulaExpr.matchAll(/\b([A-Z]+)\d*\b/g);
    for (const m of matches) {
        refs.push(m[1]);
    }
    return [...new Set(refs)];
}

/**
 * Build adjacency list from an array of columns
 * @param {Array} columns - [{ id, name, formulaExpr }]
 * @returns {Map} columnId → Set of dependency columnIds
 */
export function buildGraph(columns) {
    // Build a name→id map
    const nameToId = {};
    columns.forEach(col => {
        nameToId[col.name.toUpperCase()] = col.id;
    });

    const graph = new Map();
    columns.forEach(col => {
        graph.set(col.id, new Set());
        if (col.formulaExpr) {
            const refs = extractRefs(col.formulaExpr);
            refs.forEach(ref => {
                const depId = nameToId[ref.toUpperCase()];
                if (depId && depId !== col.id) {
                    graph.get(col.id).add(depId);
                }
            });
        }
    });
    return graph;
}

/**
 * DFS-based circular dependency detection
 * @throws {Error} if cycle detected
 */
export function checkCircular(graph, startId) {
    const visited = new Set();
    const stack = new Set();

    function dfs(nodeId) {
        if (stack.has(nodeId)) throw new Error(`Circular dependency detected at column/cell: ${nodeId}`);
        if (visited.has(nodeId)) return;
        visited.add(nodeId);
        stack.add(nodeId);
        const deps = graph.get(nodeId) || new Set();
        for (const dep of deps) dfs(dep);
        stack.delete(nodeId);
    }

    dfs(startId);
}

/**
 * Kahn's algorithm topological sort
 * @returns {Array} ordered array of column ids for recalculation
 */
export function topoSort(graph) {
    const inDegree = new Map();
    const allNodes = [...graph.keys()];

    allNodes.forEach(n => inDegree.set(n, 0));
    allNodes.forEach(n => {
        graph.get(n).forEach(dep => {
            inDegree.set(dep, (inDegree.get(dep) || 0) + 1);
        });
    });

    const queue = allNodes.filter(n => inDegree.get(n) === 0);
    const result = [];

    while (queue.length) {
        const node = queue.shift();
        result.push(node);
        graph.get(node).forEach(dep => {
            inDegree.set(dep, inDegree.get(dep) - 1);
            if (inDegree.get(dep) === 0) queue.push(dep);
        });
    }

    if (result.length !== allNodes.length) {
        throw new Error("Circular dependency detected in column graph");
    }

    return result;
}

export default { buildGraph, checkCircular, topoSort, extractRefs };
