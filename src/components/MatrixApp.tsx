import * as React from "react";
import { MatrixRowNode, MatrixColNode, MatrixHeaderNode } from "../parser";
import { VisualFormattingSettingsModel } from "../settings";
import { formatValue, computeDataBarStyle } from "../formatting";

export interface MatrixAppProps {
    rows: MatrixRowNode[];
    columns: MatrixColNode[];
    headerTree: MatrixHeaderNode[];
    settings: VisualFormattingSettingsModel;
}

// ── Flatten helpers ──────────────────────────────────────────────────────────

function flattenRows(
    nodes: MatrixRowNode[],
    expandedState: Record<string, boolean>,
    showSubtotals: boolean,
    showGrandTotal: boolean,
    showBlankRows: boolean,
    subtotalPosition: string
): MatrixRowNode[] {
    let result: MatrixRowNode[] = [];
    for (const node of nodes) {
        // Filter grand totals
        if (node.isGrandTotal && !showGrandTotal) continue;
        // Filter subtotals (non-grand)
        if (node.isSubtotal && !node.isGrandTotal && !showSubtotals) continue;
        // Filter blank rows
        if (node.isBlankRow && !showBlankRows) continue;

        const isExpanded = expandedState[node.id] ?? node.isExpanded;

        if (subtotalPosition === "top" && node.isSubtotal && !node.isGrandTotal && node.children) {
            // Subtotal at top — render this node first then its children
            result.push(node);
            const childResult = flattenRows(node.children, expandedState, showSubtotals, showGrandTotal, showBlankRows, subtotalPosition);
            result = result.concat(childResult);
        } else {
            result.push(node);
            if (isExpanded && node.children) {
                result = result.concat(
                    flattenRows(node.children, expandedState, showSubtotals, showGrandTotal, showBlankRows, subtotalPosition)
                );
            }
        }
    }
    return result;
}

function sortRows(
    nodes: MatrixRowNode[],
    sortState: { colIndex: number; direction: "asc" | "desc" } | null
): MatrixRowNode[] {
    if (!sortState) return nodes;

    // Always keep grand total at the end
    const grandTotals = nodes.filter(n => n.isGrandTotal);
    const regular = nodes.filter(n => !n.isGrandTotal);

    const sorted = [...regular].sort((a, b) => {
        // Subtotals stay relative to their group — don't sort them against regular rows
        if (a.isSubtotal || b.isSubtotal) return 0;
        const valA = a.values[sortState.colIndex]?.value ?? null;
        const valB = b.values[sortState.colIndex]?.value ?? null;
        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        const cmp = valA > valB ? 1 : -1;
        return sortState.direction === "asc" ? cmp : -cmp;
    });

    const sortedWithChildren = sorted.map(node => ({
        ...node,
        children: node.children ? sortRows(node.children, sortState) : undefined
    }));

    return [...sortedWithChildren, ...grandTotals];
}

// ── Header level extraction ──────────────────────────────────────────────────

function buildHeaderLevels(headerTree: MatrixHeaderNode[]): MatrixHeaderNode[][] {
    const levels: MatrixHeaderNode[][] = [];
    function traverse(nodes: MatrixHeaderNode[], depth: number) {
        if (!levels[depth]) levels[depth] = [];
        for (const node of nodes) {
            levels[depth].push(node);
            if (node.children && node.children.length > 0) {
                traverse(node.children, depth + 1);
            }
        }
    }
    traverse(headerTree, 0);
    return levels;
}

// ── Data bar min/max computation ─────────────────────────────────────────────

function computeColRange(rows: MatrixRowNode[], colIndex: number): { min: number; max: number } {
    let min = Infinity;
    let max = -Infinity;
    function visit(nodes: MatrixRowNode[]) {
        for (const n of nodes) {
            const v = Number(n.values[colIndex]?.value);
            if (!isNaN(v)) { if (v < min) min = v; if (v > max) max = v; }
            if (n.children) visit(n.children);
        }
    }
    visit(rows);
    return { min: min === Infinity ? 0 : min, max: max === -Infinity ? 0 : max };
}

// ── MatrixApp ────────────────────────────────────────────────────────────────

export const MatrixApp: React.FC<MatrixAppProps> = ({ rows, columns, headerTree, settings }) => {
    const [expandedState, setExpandedState] = React.useState<Record<string, boolean>>({});
    const [sortState, setSortState] = React.useState<{ colIndex: number; direction: "asc" | "desc" } | null>(null);

    const toggleExpand = (id: string) => {
        setExpandedState(prev => {
            const current = prev[id] ?? true;
            return { ...prev, [id]: !current };
        });
    };

    const toggleSort = (colIndex: number) => {
        setSortState(prev => {
            if (prev && prev.colIndex === colIndex) {
                if (prev.direction === "asc") return { colIndex, direction: "desc" };
                return null;
            }
            return { colIndex, direction: "asc" };
        });
    };

    const showRowSubtotals = settings.rowSubtotals.show.value;
    const showColSubtotals = settings.columnSubtotals.show.value;
    const showRowGrandTotal = settings.rowGrandTotal.show.value;
    const showColGrandTotal = settings.columnGrandTotal.show.value;
    const showBlankRows = settings.blankRows.showBlankRows.value;
    const rowSubtotalPosition = String((settings.rowSubtotals.position.value as any)?.value ?? "bottom");

    const flatRows = React.useMemo(() => {
        const sorted = sortRows(rows, sortState);
        return flattenRows(sorted, expandedState, showRowSubtotals, showRowGrandTotal, showBlankRows, rowSubtotalPosition);
    }, [rows, expandedState, sortState, showRowSubtotals, showRowGrandTotal, showBlankRows, rowSubtotalPosition]);

    const headerLevels = React.useMemo(() => buildHeaderLevels(headerTree), [headerTree]);

    const colRanges = React.useMemo(() => {
        if (!settings.cellElements.showDataBars.value) return [];
        return columns.map((_, idx) => computeColRange(rows, idx));
    }, [rows, columns, settings.cellElements.showDataBars.value]);

    // ── Derived style values ─────────────────────────────────────────────────

    const S = settings;
    const grd = S.grid;
    const vals = S.values;
    const colH = S.columnHeaders;
    const rowH = S.rowHeaders;
    const bars = S.cellElements;

    const rowPad = Math.max(0, Number(grd.rowPadding.value));

    const containerStyle: React.CSSProperties = {
        width: "100%",
        height: "100%",
        overflow: "auto",
        fontFamily: vals.fontFamily.value,
        fontSize: `${Math.max(8, Number(vals.fontSize.value))}px`,
        color: vals.fontColor.value?.value ?? "#252423",
        backgroundColor: "#ffffff"
    };

    const tableStyle: React.CSSProperties = {
        borderCollapse: "collapse",
        width: "100%",
        tableLayout: colH.autoSizeWidth.value ? "auto" : "fixed"
    };

    const thBaseStyle: React.CSSProperties = {
        padding: `${rowPad + 3}px 8px`,
        fontFamily: colH.fontFamily.value,
        fontSize: `${Math.max(8, Number(colH.fontSize.value))}px`,
        fontWeight: colH.bold.value ? 700 : 400,
        fontStyle: colH.italic.value ? "italic" : "normal",
        color: colH.fontColor.value?.value ?? "#252423",
        backgroundColor: colH.backgroundColor.value?.value ?? "#ffffff",
        whiteSpace: colH.wordWrap.value ? "normal" : "nowrap",
        borderBottom: grd.showHorizontalLines.value
            ? `${Math.max(1, Number(grd.horizontalLineWeight.value))}px solid ${grd.horizontalLineColor.value?.value ?? "#edebe9"}`
            : "none",
        position: "sticky" as const,
        top: 0,
        zIndex: 1
    };

    const rowHeaderBaseStyle = (level: number): React.CSSProperties => ({
        padding: `${rowPad + 3}px 8px`,
        paddingLeft: rowH.steppedLayout.value ? `${level * Math.max(0, Number(rowH.steppedLayoutIndent.value)) + 8}px` : "8px",
        fontFamily: rowH.fontFamily.value,
        fontSize: `${Math.max(8, Number(rowH.fontSize.value))}px`,
        fontWeight: rowH.bold.value ? 700 : 400,
        fontStyle: rowH.italic.value ? "italic" : "normal",
        color: rowH.fontColor.value?.value ?? "#252423",
        backgroundColor: rowH.backgroundColor.value?.value ?? "#ffffff",
        whiteSpace: rowH.wordWrap.value ? "normal" : "nowrap",
        position: "sticky" as const,
        left: 0,
        zIndex: 1,
        borderBottom: grd.showHorizontalLines.value
            ? `${Math.max(1, Number(grd.horizontalLineWeight.value))}px solid ${grd.horizontalLineColor.value?.value ?? "#edebe9"}`
            : "none",
        borderRight: grd.showVerticalLines.value
            ? `${Math.max(1, Number(grd.verticalLineWeight.value))}px solid ${grd.verticalLineColor.value?.value ?? "#edebe9"}`
            : "none"
    });

    const valueCellStyle = (colIdx: number): React.CSSProperties => {
        const specificIdx = Number(S.specificColumn.applyToColumnIndex.value);
        const useSpecific = colIdx === specificIdx;
        const specificAlign = useSpecific ? String((S.specificColumn.textAlignment.value as any)?.value ?? "default") : "default";

        let align = String((vals.textAlignment.value as any)?.value ?? "right");
        if (useSpecific && specificAlign !== "default") align = specificAlign;

        return {
            padding: `${rowPad + 3}px 8px`,
            fontFamily: vals.fontFamily.value,
            fontSize: `${Math.max(8, Number(vals.fontSize.value))}px`,
            fontWeight: vals.bold.value ? 700 : 400,
            fontStyle: vals.italic.value ? "italic" : "normal",
            color: useSpecific && S.specificColumn.fontColor.value?.value ? S.specificColumn.fontColor.value?.value : (vals.fontColor.value?.value ?? "#252423"),
            backgroundColor: useSpecific && S.specificColumn.backgroundColor.value?.value ? S.specificColumn.backgroundColor.value?.value : (vals.backgroundColor.value?.value ?? "#ffffff"),
            textAlign: align as any,
            whiteSpace: vals.wordWrap.value ? "normal" : "nowrap",
            borderBottom: grd.showHorizontalLines.value
                ? `${Math.max(1, Number(grd.horizontalLineWeight.value))}px solid ${grd.horizontalLineColor.value?.value ?? "#edebe9"}`
                : "none",
            borderLeft: grd.showVerticalLines.value
                ? `${Math.max(1, Number(grd.verticalLineWeight.value))}px solid ${grd.verticalLineColor.value?.value ?? "#edebe9"}`
                : "none",
            position: "relative",
            overflow: "hidden"
        };
    };

    const subtotalRowStyle = (isGrand: boolean): React.CSSProperties => {
        const card = isGrand ? S.rowGrandTotal : S.rowSubtotals;
        return {
            fontFamily: card.fontFamily.value,
            fontSize: `${Math.max(8, Number(card.fontSize.value))}px`,
            fontWeight: card.bold.value ? 700 : 400,
            color: card.fontColor.value?.value ?? "#252423",
            backgroundColor: card.backgroundColor.value?.value ?? "#f3f2f1"
        };
    };

    const subtotalLabel = (isGrand: boolean) =>
        isGrand
            ? String(S.rowGrandTotal.label.value || "Total")
            : String(S.rowSubtotals.label.value || "Total");

    const displayUnits = String((vals.displayUnits.value as any)?.value ?? "auto");
    const decimalPlaces = Math.max(0, Math.min(10, Number(vals.decimalPlaces.value)));

    const showDataBars = bars.showDataBars.value;
    const posBarColor = bars.positiveBarColor.value?.value ?? "#2d7dd2";
    const negBarColor = bars.negativeBarColor.value?.value ?? "#e63946";
    const showBarAxis = bars.showBarAxis.value;
    const barAxisColor = bars.barAxisColor.value?.value ?? "#8a8886";

    // ── Render ───────────────────────────────────────────────────────────────

    const numHeaderRows = headerLevels.length || 1;

    return (
        <div style={containerStyle}>
            <table style={tableStyle}>
                <thead>
                    {headerLevels.length === 0 ? (
                        <tr>
                            <th style={{ ...thBaseStyle, textAlign: "left", left: 0, zIndex: 2, position: "sticky" }}>Row</th>
                        </tr>
                    ) : headerLevels.map((levelNodes, levelIdx) => (
                        <tr key={levelIdx}>
                            {/* Row header corner cell */}
                            {levelIdx === headerLevels.length - 1 && (
                                <th style={{ ...thBaseStyle, textAlign: "left", left: 0, zIndex: 2, position: "sticky" }}>
                                    Row
                                </th>
                            )}
                            {levelIdx < headerLevels.length - 1 && levelIdx === 0 && (
                                <th
                                    style={{ ...thBaseStyle, textAlign: "left", left: 0, zIndex: 2, position: "sticky" }}
                                    rowSpan={numHeaderRows - 1 || 1}
                                />
                            )}
                            {/* Column header cells */}
                            {levelNodes.map((node, nodeIdx) => {
                                // Filter column subtotals if toggled off
                                if (node.isSubtotal && !showColSubtotals) return null;

                                const isLeaf = node.colSpan === 1 && node.colIndex !== undefined;
                                const headerAlign = String((colH.textAlignment.value as any)?.value ?? "right");
                                return (
                                    <th
                                        key={`${levelIdx}-${nodeIdx}`}
                                        colSpan={node.colSpan}
                                        style={{
                                            ...thBaseStyle,
                                            textAlign: node.colSpan > 1 ? "center" : (headerAlign as any),
                                            cursor: isLeaf ? "pointer" : "default",
                                            borderLeft: grd.showVerticalLines.value
                                                ? `${Math.max(1, Number(grd.verticalLineWeight.value))}px solid ${grd.verticalLineColor.value?.value ?? "#edebe9"}`
                                                : "none",
                                            userSelect: "none"
                                        }}
                                        onClick={() => {
                                            if (isLeaf) toggleSort(node.colIndex!);
                                        }}
                                    >
                                        {node.value}
                                        {isLeaf && sortState?.colIndex === node.colIndex
                                            ? (sortState.direction === "asc" ? " ▲" : " ▼")
                                            : ""}
                                    </th>
                                );
                            })}
                        </tr>
                    ))}
                </thead>
                <tbody>
                    {flatRows.map((row, rowIdx) => {
                        const isSub = row.isSubtotal && !row.isGrandTotal;
                        const isGrand = row.isGrandTotal;
                        const subStyle = (isSub || isGrand) ? subtotalRowStyle(isGrand) : {};
                        const rowLabel = (isSub || isGrand) ? subtotalLabel(isGrand) : null;

                        const altBg = grd.alternatingRowBg.value && rowIdx % 2 === 1
                            ? grd.alternatingRowColor.value?.value ?? "#f3f2f1"
                            : undefined;

                        return (
                            <tr
                                key={row.id}
                                style={{ backgroundColor: altBg }}
                            >
                                {/* Row header cell */}
                                <td
                                    style={{
                                        ...rowHeaderBaseStyle(row.level),
                                        ...(isSub || isGrand ? {
                                            fontFamily: subStyle.fontFamily,
                                            fontSize: subStyle.fontSize,
                                            fontWeight: subStyle.fontWeight,
                                            color: subStyle.color,
                                            backgroundColor: subStyle.backgroundColor ?? rowHeaderBaseStyle(row.level).backgroundColor
                                        } : {}),
                                        paddingLeft: rowH.steppedLayout.value
                                            ? `${row.level * Math.max(0, Number(rowH.steppedLayoutIndent.value)) + 8}px`
                                            : "8px"
                                    }}
                                >
                                    {row.isExpandable && (
                                        <span
                                            style={{
                                                display: "inline-block",
                                                width: 12,
                                                height: 12,
                                                lineHeight: "10px",
                                                textAlign: "center",
                                                border: `1px solid ${rowH.expandCollapseIconColor.value?.value ?? "#323130"}`,
                                                marginRight: 6,
                                                fontSize: 10,
                                                color: rowH.expandCollapseIconColor.value?.value ?? "#323130",
                                                cursor: "pointer",
                                                verticalAlign: "middle",
                                                userSelect: "none",
                                                flexShrink: 0
                                            }}
                                            onClick={() => toggleExpand(row.id)}
                                        >
                                            {(expandedState[row.id] ?? row.isExpanded) ? "−" : "+"}
                                        </span>
                                    )}
                                    {rowLabel !== null ? rowLabel : (row.value ?? "(Blank)")}
                                </td>

                                {/* Value cells */}
                                {columns.map((col, colIdx) => {
                                    if (col.isSubtotal && !showColSubtotals) return null;

                                    const valObj = row.values[colIdx];
                                    const rawVal = valObj?.value;
                                    const formatted = formatValue(rawVal, displayUnits, decimalPlaces);

                                    const cellStyle = valueCellStyle(colIdx);
                                    const mergedCellStyle: React.CSSProperties = {
                                        ...cellStyle,
                                        ...(isSub || isGrand ? {
                                            fontFamily: subStyle.fontFamily,
                                            fontSize: subStyle.fontSize,
                                            fontWeight: subStyle.fontWeight,
                                            color: subStyle.color,
                                            backgroundColor: subStyle.backgroundColor
                                        } : {})
                                    };

                                    if (altBg && !isSub && !isGrand) {
                                        mergedCellStyle.backgroundColor = altBg;
                                    }

                                    // Data bar
                                    let barEl: React.ReactNode = null;
                                    if (showDataBars && colRanges[colIdx]) {
                                        const { min, max } = colRanges[colIdx];
                                        const { barStyle, showBar } = computeDataBarStyle(
                                            rawVal, min, max,
                                            posBarColor, negBarColor,
                                            showBarAxis, barAxisColor
                                        );
                                        if (showBar) {
                                            barEl = <div style={barStyle as React.CSSProperties} />;
                                        }
                                    }

                                    return (
                                        <td key={colIdx} style={mergedCellStyle}>
                                            {barEl}
                                            <span style={{ position: "relative", zIndex: 1 }}>{formatted}</span>
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};
