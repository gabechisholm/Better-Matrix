import powerbi from "powerbi-visuals-api";

export interface MatrixRowNode {
    id: string;
    level: number;
    value: any;
    isExpandable: boolean;
    isExpanded: boolean;
    isSubtotal: boolean;
    isGrandTotal: boolean;
    isBlankRow?: boolean;
    children?: MatrixRowNode[];
    values: { [colId: string]: powerbi.DataViewMatrixNodeValue };
}

export interface MatrixColNode {
    id: string;
    level: number;
    value: any;
    measureIndex?: number;
    isSubtotal?: boolean;
    isGrandTotal?: boolean;
    role?: "values" | "functionValue";
    formatString?: string;
}

export interface MatrixHeaderNode {
    id: string;
    level: number;
    value: any;
    colSpan: number;
    isMeasure: boolean;
    isSubtotal?: boolean;
    isGrandTotal?: boolean;
    colIndex?: number;
    children?: MatrixHeaderNode[];
}

export interface ParsedMatrix {
    rows: MatrixRowNode[];
    columns: MatrixColNode[];
    headerTree: MatrixHeaderNode[];
    numLevels: number;
    numColLevels: number;
    functionValueColIndices: Set<number>;
}

export function parseMatrix(dataView: powerbi.DataView): ParsedMatrix {
    const matrix = dataView.matrix;
    if (!matrix || !matrix.rows || !matrix.columns) {
        return { rows: [], columns: [], headerTree: [], numLevels: 0, numColLevels: 0, functionValueColIndices: new Set() };
    }

    const valueSources = matrix.valueSources || [];
    const numColLevels = matrix.columns.levels ? matrix.columns.levels.length : 0;

    // Which measure indices (into valueSources) belong to the functionValue role
    const fnMeasureIndices = new Set<number>();
    valueSources.forEach((vs, i) => {
        if ((vs.roles as any)?.["functionValue"]) fnMeasureIndices.add(i);
    });

    let leafIndex = 0;
    const leafCols: MatrixColNode[] = [];

    // ── Column Header Tree ─────────────────────────────────────────────────
    // A column node is a grand-total when it is a subtotal at level 0
    // (direct child of the column root with no grouping parent).
    function buildHeaderTree(node: powerbi.DataViewMatrixNode, level: number, path: string): MatrixHeaderNode {
        const id = path ? `${path}_${node.value}` : `${node.value}`;
        const isSubtotal = !!node.isSubtotal;
        const isGrandTotal = isSubtotal && level === 0;

        let children: MatrixHeaderNode[] = [];
        let colSpan = 0;

        if (!node.children || node.children.length === 0) {
            if (node.level === numColLevels) {
                const vsIdx = node.levelSourceIndex || 0;
                const role = fnMeasureIndices.has(vsIdx) ? "functionValue" : "values";
                const formatString = valueSources[vsIdx]?.format;
                leafCols.push({ id: `${id}_m${vsIdx}`, level, value: valueSources[vsIdx]?.displayName ?? "", measureIndex: vsIdx, isSubtotal, isGrandTotal, role, formatString });
                return { id, level, value: valueSources[vsIdx]?.displayName ?? "", colSpan: 1, isMeasure: true, isSubtotal, isGrandTotal, colIndex: leafIndex++ };
            } else if (valueSources.length > 1) {
                children = valueSources.map((vs, idx) => {
                    const role = fnMeasureIndices.has(idx) ? "functionValue" : "values";
                    const formatString = vs.format;
                    leafCols.push({ id: `${id}_m${idx}`, level: level + 1, value: vs.displayName, measureIndex: idx, isSubtotal, isGrandTotal, role, formatString });
                    return { id: `${id}_m${idx}`, level: level + 1, value: vs.displayName, colSpan: 1, isMeasure: true, isSubtotal, isGrandTotal, colIndex: leafIndex++ };
                });
                colSpan = children.length;
            } else {
                const role = fnMeasureIndices.has(0) ? "functionValue" : "values";
                const formatString = valueSources[0]?.format;
                leafCols.push({ id, level, value: node.value, measureIndex: 0, isSubtotal, isGrandTotal, role, formatString });
                return { id, level, value: node.value, colSpan: 1, isMeasure: false, isSubtotal, isGrandTotal, colIndex: leafIndex++ };
            }
        } else {
            children = node.children.map(child => buildHeaderTree(child, level + 1, id));
            colSpan = children.reduce((sum, c) => sum + c.colSpan, 0);
        }

        return { id, level, value: node.value, colSpan, isMeasure: false, isSubtotal, isGrandTotal, children };
    }

    const headerTree = matrix.columns.root.children
        ? matrix.columns.root.children.map(child => buildHeaderTree(child, 0, ""))
        : [];

    // Also add grand-total column node if it exists at root values level
    // (Power BI sometimes embeds grand total values at rows.root level)

    // ── Row Tree ──────────────────────────────────────────────────────────
    let maxRowLevel = 0;

    function traverseRows(node: powerbi.DataViewMatrixNode, level: number, path: string): MatrixRowNode {
        const id = path ? `${path}__${node.value}__${level}` : `${node.value}__${level}`;
        if (level > maxRowLevel) maxRowLevel = level;

        const isSubtotal = !!node.isSubtotal;
        // Grand total: subtotal at level 0 (direct child of root) or explicitly flagged
        const isGrandTotal = isSubtotal && level === 0;

        const rowNode: MatrixRowNode = {
            id,
            level,
            value: node.value,
            isExpandable: !!node.children && node.children.length > 0 && !isSubtotal,
            isExpanded: true,
            isSubtotal,
            isGrandTotal,
            values: {}
        };

        if (node.values) {
            Object.keys(node.values).forEach(key => {
                rowNode.values[key] = node.values[key];
            });
        }

        if (node.children) {
            rowNode.children = node.children.map(child => traverseRows(child, level + 1, id));
        }

        return rowNode;
    }

    const parsedRows: MatrixRowNode[] = matrix.rows.root.children
        ? matrix.rows.root.children.map(child => traverseRows(child, 0, ""))
        : [];

    // Build functionValueColIndices from leaf columns
    const functionValueColIndices = new Set<number>();
    leafCols.forEach((col, idx) => {
        if (!col.isSubtotal && !col.isGrandTotal && col.role === "functionValue") {
            functionValueColIndices.add(idx);
        }
    });

    return { rows: parsedRows, columns: leafCols, headerTree, numLevels: maxRowLevel + 1, numColLevels, functionValueColIndices };
}
